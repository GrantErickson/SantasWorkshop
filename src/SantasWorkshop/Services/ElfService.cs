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

    public async Task<(ElfAnswer Answer, string Source, double Seconds)> GrantWishAsync(string text, CancellationToken ct)
    {
        var timer = Stopwatch.StartNew();
        if (_client is not null)
        {
            try
            {
                var answer = await AskAsync<ElfAnswer>(
                    ElfPrompts.WishSystem(_options), ElfPrompts.WishUser(text), _wishSchema, ct);
                return (Normalize(answer, text), "claude", timer.Elapsed.TotalSeconds);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                _logger.LogError(ex, "Claude could not grant the wish; using the backup elf.");
            }
        }
        return (_backup.GrantWish(text), "backup", timer.Elapsed.TotalSeconds);
    }

    public async Task<StarterPlan> WriteStarterPlanAsync(Wish wish, Lead lead, CancellationToken ct)
    {
        if (_client is not null)
        {
            try
            {
                var plan = await AskAsync<StarterPlan>(
                    ElfPrompts.PlanSystem(_options), ElfPrompts.PlanUser(wish, lead), _planSchema, ct);
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

    private async Task<T> AskAsync<T>(string system, string user, Dictionary<string, JsonElement> schema, CancellationToken ct)
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
                return JsonSerializer.Deserialize<T>(json, JsonOptions)
                       ?? throw new InvalidOperationException("Claude returned empty JSON.");
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
