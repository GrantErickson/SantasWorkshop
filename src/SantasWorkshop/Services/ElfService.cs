using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Beta;
using Anthropic.Models.Beta.Messages;
using Microsoft.Extensions.Options;
using SantasWorkshop.Models;

namespace SantasWorkshop.Services;

/// <summary>
/// Asks Claude for the blueprint + practical answer (and later the starter plan). Any failure
/// (no key, timeout, refusal, bad JSON) falls back to the offline <see cref="BackupElf"/> so the
/// kiosk always shows something.
/// </summary>
public sealed class ElfService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly WorkshopOptions _options;
    private readonly BackupElf _backup;
    private readonly ILogger<ElfService> _logger;
    private readonly AnthropicClient? _client;
    private readonly Dictionary<string, JsonElement> _wishSchema = ElfPrompts.WishSchema();
    private readonly Dictionary<string, JsonElement> _planSchema = ElfPrompts.PlanSchema();

    public ElfService(IOptions<WorkshopOptions> options, IConfiguration config, BackupElf backup, ILogger<ElfService> logger)
    {
        _options = options.Value;
        _backup = backup;
        _logger = logger;

        // ANTHROPIC_API_KEY env var, or Anthropic:ApiKey from user-secrets / app settings.
        var apiKey = config["Anthropic:ApiKey"] ?? Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (_options.UseBackupElfOnly)
        {
            _logger.LogWarning("Workshop:UseBackupElfOnly is on; Claude will not be called.");
        }
        else if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("No Anthropic API key found (ANTHROPIC_API_KEY or Anthropic:ApiKey). Using the backup elf.");
        }
        else
        {
            _client = new AnthropicClient
            {
                ApiKey = apiKey,
                Timeout = TimeSpan.FromSeconds(_options.ClaudeTimeoutSeconds),
                MaxRetries = 1,
            };
        }
    }

    public bool ClaudeEnabled => _client is not null;

    /// <summary>
    /// The answer, where it came from, how long it took, and a note for staff when anything was unusual: another model
    /// answered, an answer came back hollow and was asked for again, or the backup elf stepped in. The note is empty
    /// when Claude answered normally.
    /// </summary>
    public async Task<(ElfAnswer Answer, string Source, double Seconds, string Note)> GrantWishAsync(string text, CancellationToken ct)
    {
        var timer = Stopwatch.StartNew();
        var notes = new List<string>();
        if (_client is not null)
        {
            try
            {
                // An answer can come back as valid JSON with placeholder text ("x") and no steps. Ask once more
                // before handing the wish to the backup elf, so a guest never sees one.
                for (var attempt = 1; attempt <= 2; attempt++)
                {
                    var reply = await AskAsync<ElfAnswer>(
                        ElfPrompts.WishSystem(_options), ElfPrompts.WishUser(text), _wishSchema, ct);
                    var served = reply.FellBack ? $"{reply.Model} (fallback)" : reply.Model;
                    var missing = Missing(reply.Value);
                    if (missing is null)
                    {
                        if (reply.FellBack) notes.Add($"answered by {served}");
                        if ((reply.Value.Practical.Tldr?.Count ?? 0) < 3) notes.Add("no at-a-glance steps");
                        return (Normalize(reply.Value, text), "claude", timer.Elapsed.TotalSeconds, string.Join("; ", notes));
                    }
                    _logger.LogWarning("Claude's answer {Attempt} came back hollow ({Missing}) from {Model}: {Json}",
                        attempt, missing, served, Clip(reply.Json, 3000));
                    notes.Add($"answer {attempt} from {served} came back hollow ({missing})");
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _logger.LogError(ex, "Claude could not grant the wish; using the backup elf.");
                notes.Add($"Claude failed ({Clip(ex.Message, 120)})");
            }
        }
        return (_backup.GrantWish(text), "backup", timer.Elapsed.TotalSeconds, string.Join("; ", notes));
    }

    /// <summary>
    /// Which parts of an answer came back as placeholders, or null when it's whole. A wish judged unfit for the wall
    /// is never shown, so it always passes.
    /// </summary>
    private static string? Missing(ElfAnswer a)
    {
        if (!a.Appropriate) return null;
        var p = a.Practical;
        var missing = new List<string>();
        if ((a.Blueprint?.MachineName?.Trim().Length ?? 0) < 4) missing.Add("machine name");
        if ((a.Blueprint?.Fineprint?.Trim().Length ?? 0) < 8) missing.Add("fineprint");
        if ((p?.Headline?.Trim().Length ?? 0) < 20) missing.Add("headline");
        if ((p?.Steps?.Count(s => (s?.Trim().Length ?? 0) >= 10) ?? 0) < 2) missing.Add("steps");
        if ((p?.FirstStep?.Trim().Length ?? 0) < 15) missing.Add("first step");
        return missing.Count == 0 ? null : string.Join(", ", missing);
    }

    public async Task<StarterPlan> WriteStarterPlanAsync(Wish wish, Lead lead, CancellationToken ct)
    {
        if (_client is not null)
        {
            try
            {
                var plan = (await AskAsync<StarterPlan>(
                    ElfPrompts.PlanSystem(_options), ElfPrompts.PlanUser(wish, lead), _planSchema, ct)).Value;
                plan.Source = "claude";
                return plan;
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _logger.LogError(ex, "Claude could not write the starter plan; using the backup template.");
            }
        }
        return _backup.WriteStarterPlan(wish);
    }

    /// <summary>
    /// What Claude sent back: the parsed answer, the raw JSON (for the log when an answer looks wrong), the model that
    /// actually wrote it, and whether the request fell back to another model after a safety classifier declined.
    /// </summary>
    private sealed record Reply<T>(T Value, string Json, string Model, bool FellBack);

    private async Task<Reply<T>> AskAsync<T>(string system, string user, Dictionary<string, JsonElement> schema, CancellationToken ct)
    {
        var useFast = _options.UseFastMode;
        while (true)
        {
            var parameters = new MessageCreateParams
            {
                Model = _options.Model,
                MaxTokens = 8000,
                // If a safety classifier declines, the API re-serves the request on a fallback model.
                Betas = [AnthropicBeta.ServerSideFallback2026_07_01],
                Fallbacks = new Default(),
                System = system,
                Messages = [new BetaUserMessageParam { Content = user }],
                OutputConfig = new BetaOutputConfig
                {
                    Effort = ParseEffort(_options.Effort),
                    Format = new BetaJsonOutputFormat { Schema = schema },
                },
                Speed = useFast ? Speed.Fast : null,
            };

            try
            {
                BetaMessage response = await _client!.Beta.Messages.Create(parameters, ct);
                if (response.StopReason == "refusal")
                    throw new InvalidOperationException($"Claude declined: {response.StopDetails?.Category}");
                if (response.StopReason == "max_tokens")
                    throw new InvalidOperationException("Claude ran out of tokens before finishing the JSON.");

                var json = string.Concat(response.Content.Select(b => b.TryPickText(out var t) ? t.Text : ""));
                var value = JsonSerializer.Deserialize<T>(json, JsonOptions)
                            ?? throw new InvalidOperationException("Claude returned empty JSON.");
                // A fallback leaves a marker block where it switched models; a request routed straight to the
                // fallback model (it remembers recent fallbacks for a while) has no marker, only a different model.
                var model = response.Model.Raw();
                var fellBack = response.Content.Any(b => b.TryPickFallback(out _))
                               || !string.Equals(model, _options.Model, StringComparison.OrdinalIgnoreCase);
                return new Reply<T>(value, json, model, fellBack);
            }
            catch (AnthropicRateLimitException) when (useFast)
            {
                // Fast mode has its own rate limit; drop back to standard speed rather than fail.
                _logger.LogWarning("Fast mode rate limited; retrying at standard speed.");
                useFast = false;
            }
        }
    }

    private static Effort ParseEffort(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "medium" => Effort.Medium,
        "high" => Effort.High,
        _ => Effort.Low,
    };

    /// <summary>Clamp lengths and counts so one odd answer can't break the TV layout.</summary>
    private static ElfAnswer Normalize(ElfAnswer a, string originalText)
    {
        a.Category = Catalog.NormalizeCategory(a.Category);
        a.WallText = Clip(a.WallText.Trim().TrimEnd('.', '!', '…'), 70);
        if (string.IsNullOrWhiteSpace(a.WallText)) a.WallText = BackupElf.ToWallText(originalText);

        var b = a.Blueprint;
        b.MachineName = Clip(b.MachineName, 40);
        b.Tagline = Clip(b.Tagline, 90);
        b.Fineprint = Clip(b.Fineprint, 90);
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        b.Modules = b.Modules
            .Where(m => Catalog.ModuleKinds.Contains(m.Kind) && used.Add(m.Kind))
            .Take(5)
            .Select(m => new BlueprintModule { Kind = m.Kind.ToLowerInvariant(), Label = Clip(m.Label, 26) })
            .ToList();
        if (b.Modules.Count < 3) b.Modules = BackupElf.DefaultModules();

        var p = a.Practical;
        p.Headline = Clip(p.Headline, 220);
        p.Steps = p.Steps.Where(s => !string.IsNullOrWhiteSpace(s)).Take(3).Select(s => Clip(s, 160)).ToList();
        p.Techniques = p.Techniques.Where(s => !string.IsNullOrWhiteSpace(s)).Take(3).Select(s => Clip(s, 32)).ToList();
        p.FirstStep = Clip(p.FirstStep, 240);
        p.HoursAssumption = Clip(p.HoursAssumption, 120);
        p.HoursSavedPerYear = Math.Clamp(p.HoursSavedPerYear, 10, 5000);
        p.Tldr = NormalizeTldr(p.Tldr);
        return a;
    }

    private static readonly string[] DefaultTldrIcons = ["📥", "🤖", "✅"];

    /// <summary>Exactly three beats, each one emoji and a few words, or none at all (the screens then skip the summary).</summary>
    private static List<TldrBeat> NormalizeTldr(List<TldrBeat>? beats)
    {
        var clean = (beats ?? []).Where(b => !string.IsNullOrWhiteSpace(b?.Text)).Take(3).ToList();
        if (clean.Count < 3) return [];
        return clean
            .Select((b, i) => new TldrBeat
            {
                Icon = FirstEmoji(b.Icon) ?? DefaultTldrIcons[i],
                Text = Clip(b.Text.Trim().TrimEnd('.', '!', '…'), 30),
            })
            .ToList();
    }

    /// <summary>The first emoji in the string (including any skin tone or joined parts), or null if it doesn't start with one.</summary>
    private static string? FirstEmoji(string? s)
    {
        s = s?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        var first = StringInfo.GetNextTextElement(s);
        return first.Length <= 16 && Rune.GetUnicodeCategory(Rune.GetRuneAt(first, 0)) == UnicodeCategory.OtherSymbol ? first : null;
    }

    private static string Clip(string? s, int max)
    {
        s = (s ?? "").Trim();
        return s.Length <= max ? s : s[..(max - 1)].TrimEnd() + "…";
    }
}
