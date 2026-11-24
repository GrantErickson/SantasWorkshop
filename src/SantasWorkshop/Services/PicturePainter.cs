using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Microsoft.Extensions.Options;
using SantasWorkshop.Models;

namespace SantasWorkshop.Services;

/// <summary>
/// Paints a picture of each wish's machine in the background with a Microsoft MAI image model (Microsoft Foundry),
/// after the blueprint is already on screen. Saves it as a PNG next to the data files and tells the TVs it's ready.
/// One picture at a time keeps well inside the model's requests-per-minute quota.
/// </summary>
public sealed class PicturePainter(
    WishStore store, EventHub hub, IHttpClientFactory httpFactory, IOptions<WorkshopOptions> options,
    ILogger<PicturePainter> logger) : BackgroundService
{
    public const string HttpClientName = "pictures";

    // Wide enough for the 16:10 blueprint card, and within every MAI model's size limits (1,048,576 pixels max).
    private const int Width = 1280;
    private const int Height = 800;
    private const int MaxAttempts = 3;

    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>();
    private readonly WorkshopOptions _options = options.Value;

    public bool Enabled => _options.PicturesEnabled;

    public string Folder => Path.Combine(store.DataDirectory, "pictures");

    public string PathFor(string wishId) => Path.Combine(Folder, $"{wishId}.png");

    /// <summary>Marks the wish as waiting for a picture and queues it. Returns false when pictures are off.</summary>
    public bool Request(string wishId)
    {
        if (!Enabled) return false;
        var wish = store.UpdateWish(wishId, w =>
        {
            w.PictureStatus = PictureStatuses.Pending;
            w.PictureVersion++;
        });
        if (wish is null) return false;
        _queue.Writer.TryWrite(wishId);
        return true;
    }

    public void Remove(string wishId)
    {
        store.UpdateWish(wishId, w => w.PictureStatus = PictureStatuses.Removed);
        TryDelete(PathFor(wishId));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled)
        {
            logger.LogInformation("Machine pictures are off (set Workshop:ImageEndpoint, ImageKey and ImageDeployment to turn them on).");
            // Don't leave phone cards waiting for pictures that were queued before pictures were turned off.
            foreach (var w in store.AllWishes().Where(w => w.PicturePending))
                store.UpdateWish(w.Id, x => x.PictureStatus = PictureStatuses.Failed);
            return;
        }
        Directory.CreateDirectory(Folder);

        // Anything still waiting when the site last stopped.
        foreach (var w in store.AllWishes().Where(w => w.PicturePending).Reverse()) _queue.Writer.TryWrite(w.Id);

        await foreach (var wishId in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            var wish = store.GetWish(wishId);
            if (wish is null || !wish.PicturePending) continue;
            var version = wish.PictureVersion;

            var timer = Stopwatch.StartNew();
            byte[]? png = null;
            try
            {
                png = await PaintAsync(wish, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Couldn't paint a picture for wish {Number}", wish.Number);
            }

            // Staff may have removed or repainted it while we were busy; only the latest request counts.
            if (store.GetWish(wishId) is not { PicturePending: true } current || current.PictureVersion != version) continue;

            if (png is null)
            {
                store.UpdateWish(wishId, w => w.PictureStatus = PictureStatuses.Failed);
                continue;
            }

            var path = PathFor(wishId);
            await File.WriteAllBytesAsync(path + ".tmp", png, stoppingToken);
            File.Move(path + ".tmp", path, overwrite: true);
            var seconds = Math.Round(timer.Elapsed.TotalSeconds, 1);
            var saved = store.UpdateWish(wishId, w => { w.PictureStatus = PictureStatuses.Ready; w.PictureSeconds = seconds; });
            logger.LogInformation("Painted wish {Number} in {Seconds}s ({Kb} KB)", wish.Number, seconds, png.Length / 1024);

            // Hidden wishes' ids stay private: only the wall's own wishes are announced.
            if (saved is { IsOnWall: true }) hub.Publish("picture", new { id = saved.Id, pictureUrl = saved.PictureUrl });
        }
    }

    private async Task<byte[]?> PaintAsync(Wish wish, CancellationToken ct)
    {
        var http = httpFactory.CreateClient(HttpClientName);
        var body = new ImageRequest(_options.ImageDeployment!, PicturePrompt.For(wish), Width, Height);

        for (var attempt = 1; attempt <= MaxAttempts; attempt++)
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(_options.ImageTimeoutSeconds));
            using var request = new HttpRequestMessage(HttpMethod.Post, GenerationsUrl(_options.ImageEndpoint!))
            {
                // A string body, not a streamed one: the MAI endpoint insists on a Content-Length header.
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"),
            };
            request.Headers.Add("api-key", _options.ImageKey);

            HttpResponseMessage response;
            try
            {
                response = await http.SendAsync(request, timeout.Token);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning("Picture for wish {Number} timed out after {Seconds}s (attempt {Attempt})",
                    wish.Number, _options.ImageTimeoutSeconds, attempt);
                continue;
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning("Couldn't reach the image model for wish {Number} (attempt {Attempt}): {Error}",
                    wish.Number, attempt, ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(5 * attempt), ct);
                continue;
            }

            using (response)
            {
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<ImageResponse>(ct);
                    var b64 = result?.Data?.FirstOrDefault()?.B64Json;
                    if (string.IsNullOrEmpty(b64))
                    {
                        // MAI answers with no image when its content filter declines the prompt.
                        logger.LogWarning("The image model returned no picture for wish {Number}", wish.Number);
                        return null;
                    }
                    return Convert.FromBase64String(b64);
                }

                var detail = await response.Content.ReadAsStringAsync(ct);
                if (detail.Length > 500) detail = detail[..500];
                var retry = response.StatusCode is HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
                logger.LogWarning("Image model answered {Status} for wish {Number} (attempt {Attempt}): {Detail}",
                    (int)response.StatusCode, wish.Number, attempt, detail);
                if (!retry) return null;

                var wait = response.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(10 * attempt);
                await Task.Delay(wait < TimeSpan.FromMinutes(1) ? wait : TimeSpan.FromMinutes(1), ct);
            }
        }
        return null;
    }

    /// <summary>
    /// Accepts the full generations URL, or any of the addresses Foundry shows for the resource. MAI models answer on
    /// https://{resource}.services.ai.azure.com/mai/v1/images/generations; the same resource's *.openai.azure.com and
    /// *.cognitiveservices.azure.com addresses (with or without a path such as /openai/v1) are mapped onto it.
    /// </summary>
    public static string GenerationsUrl(string endpoint)
    {
        var url = endpoint.Trim().TrimEnd('/');
        if (url.Contains("/images/generations", StringComparison.OrdinalIgnoreCase)) return url;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return $"{url}/mai/v1/images/generations";
        var host = uri.Host;
        foreach (var suffix in new[] { ".openai.azure.com", ".cognitiveservices.azure.com" })
        {
            if (host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) host = host[..^suffix.Length] + ".services.ai.azure.com";
        }
        return $"https://{host}/mai/v1/images/generations";
    }

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { /* in use; nothing links to it now */ }
    }

    private sealed record ImageRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("prompt")] string Prompt,
        [property: JsonPropertyName("width")] int Width,
        [property: JsonPropertyName("height")] int Height);

    private sealed record ImageResponse([property: JsonPropertyName("data")] List<ImageData>? Data);

    private sealed record ImageData([property: JsonPropertyName("b64_json")] string? B64Json);
}

/// <summary>Turns a wish's blueprint into a prompt for the image model.</summary>
public static class PicturePrompt
{
    // How each blueprint part should look in a painting. Kinds match Catalog.Modules.
    private static readonly Dictionary<string, string> Looks = new(StringComparer.OrdinalIgnoreCase)
    {
        ["hopper"] = "a big copper funnel hopper overflowing with papers",
        ["magnet"] = "a giant red-and-silver horseshoe magnet pulling in flying documents",
        ["scanner"] = "a large brass magnifying lens on a jointed arm, scanning a page",
        ["brain"] = "a snow globe with a softly glowing pink brain floating inside",
        ["gears"] = "a gearbox of big interlocking brass gears",
        ["sorter"] = "wooden chutes dropping items into bright colored bins",
        ["robot-arm"] = "a jointed mechanical arm tapping away at a keyboard",
        ["conveyor"] = "a conveyor belt carrying papers and envelopes",
        ["stamp"] = "a heavy press stamping documents with a gold seal",
        ["tank"] = "a glass tank full of steaming hot cocoa with a pressure gauge",
        ["bell"] = "a big golden jingle bell",
        ["antenna"] = "a candy-cane striped antenna sending out sparkling signal rings",
        ["printer"] = "a chunky printer rolling out a long sheet of paper",
        ["gift-wrapper"] = "a gift-wrapping station tying red ribbons on finished presents",
        ["chimney"] = "a little brick chimney puffing out clouds of steam",
        ["rocket"] = "a small red rocket booster with a bright flame",
        ["shredder"] = "a paper shredder spitting out curly confetti strips",
        ["mailbox"] = "a red mailbox with envelopes flying out of it",
        ["calculator"] = "an oversized vintage calculator with big round buttons",
        ["clock"] = "a big round clock with a swinging pendulum",
        ["crystal-ball"] = "a glowing crystal ball on a brass stand",
        ["lightbulb"] = "a huge glowing lightbulb",
        ["elf-wheel"] = "a wooden hamster wheel with an elf running inside it to power everything",
        ["catapult"] = "a little wooden catapult flinging wrapped parcels",
        ["crane"] = "a claw crane plucking one item from a pile",
        ["vacuum"] = "a vacuum hose sucking up scattered papers",
        ["filing-cabinet"] = "a tall wooden filing cabinet with drawers sliding open",
        ["tesla-coil"] = "a candy-cane tesla coil crackling with harmless blue sparks",
        ["telescope"] = "a brass telescope peering into the distance",
        ["chatbot"] = "a friendly screen with floating speech bubbles full of little icons",
        ["helper-bot"] = "a friendly little round-headed robot helper",
        ["spreadsheet"] = "a big board of glowing tiles filling in row by row",
        ["vault"] = "a round steel vault door with a big wheel handle",
    };

    public static string For(Wish wish)
    {
        var parts = wish.Blueprint.Modules
            .Select(m => Looks.GetValueOrDefault(m.Kind))
            .Where(look => look is not null)
            .ToList();

        var prompt = new StringBuilder();
        prompt.Append("A whimsical, cozy storybook illustration of a wonderfully over-engineered chain-reaction machine ");
        prompt.Append("that Santa's elves built in their North Pole workshop.");
        // Claude's wall text is anonymized and checked; the offline backup elf's is the guest's own words, so leave it out.
        if (wish.Source == "claude" && !string.IsNullOrWhiteSpace(wish.WallText))
            prompt.Append($" The machine's job is to {wish.WallText.Trim().TrimEnd('…', '.')}.");
        if (parts.Count > 0)
            prompt.Append($" From left to right it is built from {string.Join("; then ", parts)}, all linked together by brass pipes and little conveyor belts.");
        prompt.Append(" A few cheerful elves in red and green tend the machine. Warm glowing lanterns, twinkling fairy lights, ");
        prompt.Append("wooden beams hung with garlands, shelves of toys, and snow falling past a frosted window. Rich jewel-tone colors ");
        prompt.Append("with lots of gold, soft painterly texture, playful charming details, a wide view showing the whole machine. ");
        prompt.Append("Friendly and family-safe. No text anywhere: no letters, words, numbers, labels, signs or logos.");
        return prompt.ToString();
    }
}
