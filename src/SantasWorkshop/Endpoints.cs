using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using QRCoder;
using SantasWorkshop.Models;
using SantasWorkshop.Services;

namespace SantasWorkshop;

public sealed record WishRequest(string? Text);

public sealed record LeadRequest(string? Name, string? Email, string? Company, string? Role, bool Consent);

public sealed record HiddenRequest(bool Hidden);

public sealed record SentRequest(bool Sent);

/// <summary>What the kiosk and the guest's phone see. Includes the original text, so only served by id.</summary>
public sealed record CardDto(
    string Id, int Number, DateTimeOffset CreatedAt, string Text, string WallText, string Category,
    bool Appropriate, string Source, double ElapsedSeconds, Blueprint Blueprint, PracticalPlan Practical, bool LeadSubmitted)
{
    public static CardDto From(Wish w, bool leadSubmitted) => new(
        w.Id, w.Number, w.CreatedAt, w.Text, w.WallText, w.Category, w.Appropriate, w.Source, w.ElapsedSeconds,
        w.Blueprint, w.Practical, leadSubmitted);
}

/// <summary>What the public TV wall sees. Never includes the original text.</summary>
public sealed record WallItem(
    string Id, int Number, string WallText, string Category, int Hours, DateTimeOffset CreatedAt, Blueprint Blueprint)
{
    public static WallItem From(Wish w) =>
        new(w.Id, w.Number, w.WallText, w.Category, w.Practical.HoursSavedPerYear, w.CreatedAt, w.Blueprint);
}

public static class Endpoints
{
    public static void MapWorkshop(this WebApplication app)
    {
        MapPages(app);
        MapPublicApi(app);
        MapAdminApi(app);
    }

    private static void MapPages(WebApplication app)
    {
        var webRoot = app.Environment.WebRootPath;
        IResult Page(string file) => TypedResults.PhysicalFile(Path.Combine(webRoot, file), "text/html; charset=utf-8");

        foreach (var page in new[] { "kiosk", "wall", "counter", "admin" })
            app.MapGet($"/{page}", () => Page($"{page}.html"));
        app.MapGet("/c/{id}", (string id) => Page("card.html"));

        app.MapGet("/qr/{id}.svg", (string id, HttpRequest http, WishStore store, IOptions<WorkshopOptions> o) =>
            store.GetWish(id) is null
                ? Results.NotFound()
                : Svg(QrSvg($"{BaseUrl(http, o.Value)}/c/{id}")));
    }

    private static void MapPublicApi(WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/config", (HttpRequest http, IOptions<WorkshopOptions> o, ElfService elf) =>
        {
            var opts = o.Value;
            return new
            {
                opts.CompanyName, opts.CompanyUrl, opts.LogoUrl, opts.EventName, opts.RegionName, opts.BuiltInDays,
                PublicBaseUrl = BaseUrl(http, opts),
                KioskKeyRequired = !string.IsNullOrEmpty(opts.KioskKey),
                ClaudeEnabled = elf.ClaudeEnabled,
                Categories = Catalog.Categories,
            };
        });

        api.MapPost("/wishes", async (WishRequest req, HttpRequest http, WishStore store, ElfService elf,
            EventHub hub, IOptions<WorkshopOptions> o, CancellationToken ct) =>
        {
            if (!KeyMatches(o.Value.KioskKey, http, "X-Kiosk-Key", allowWhenUnset: true))
                return Results.Json(new { error = "This kiosk needs its key. Open it with /kiosk?key=…" }, statusCode: 401);

            var text = (req.Text ?? "").Trim();
            if (text.Length < 3) return Results.BadRequest(new { error = "Tell the elf a little more about your wish!" });
            if (text.Length > 400) text = text[..400];

            var (answer, source, seconds) = await elf.GrantWishAsync(text, ct);
            var wish = store.AddWish(new Wish
            {
                CreatedAt = DateTimeOffset.Now,
                Text = text,
                WallText = answer.WallText,
                Category = answer.Category,
                Appropriate = answer.Appropriate,
                Source = source,
                ElapsedSeconds = Math.Round(seconds, 1),
                Blueprint = answer.Blueprint,
                Practical = answer.Practical,
            });

            if (wish.IsOnWall) hub.Publish("wish", new { item = WallItem.From(wish), stats = store.GetStats() });

            return Results.Ok(new { wish = CardDto.From(wish, false), cardUrl = $"{BaseUrl(http, o.Value)}/c/{wish.Id}" });
        }).RequireRateLimiting("wish");

        api.MapGet("/wishes/{id}", (string id, WishStore store) =>
            store.GetWish(id) is { } wish
                ? Results.Ok(CardDto.From(wish, store.HasLeadForWish(id)))
                : Results.NotFound());

        api.MapGet("/wall", (WishStore store, int? take) =>
        {
            var items = store.AllWishes().Where(w => w.IsOnWall).Take(Math.Clamp(take ?? 150, 1, 500)).Select(WallItem.From);
            return new { items, stats = store.GetStats() };
        });

        api.MapGet("/stats", (WishStore store) => store.GetStats());

        api.MapGet("/events", (EventHub hub, CancellationToken ct) => TypedResults.ServerSentEvents(hub.Subscribe(ct)));

        api.MapPost("/wishes/{id}/lead", (string id, LeadRequest req, WishStore store, PlanWorker worker) =>
        {
            if (store.GetWish(id) is null) return Results.NotFound();
            if (store.HasLeadForWish(id)) return Results.Ok(new { ok = true, already = true });

            var name = (req.Name ?? "").Trim();
            var email = (req.Email ?? "").Trim();
            var company = (req.Company ?? "").Trim();
            var role = (req.Role ?? "").Trim();
            if (name.Length is 0 or > 100) return Results.BadRequest(new { error = "Please add your name." });
            if (email.Length > 200 || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email || !email.Contains('.'))
                return Results.BadRequest(new { error = "That email address doesn't look quite right." });
            if (company.Length is 0 or > 120) return Results.BadRequest(new { error = "Please add your company." });
            if (role.Length > 120) role = role[..120];
            if (!req.Consent) return Results.BadRequest(new { error = "Please tick the box so we're allowed to email you." });

            var lead = store.AddLead(new Lead
            {
                WishId = id, CreatedAt = DateTimeOffset.Now, Name = name, Email = email, Company = company, Role = role,
                Consent = true,
            });
            worker.Enqueue(lead.Id);
            return Results.Ok(new { ok = true, already = false });
        }).RequireRateLimiting("lead");
    }

    private static void MapAdminApi(WebApplication app)
    {
        var admin = app.MapGroup("/api/admin");
        admin.AddEndpointFilter(async (ctx, next) =>
        {
            var key = ctx.HttpContext.RequestServices.GetRequiredService<IOptions<WorkshopOptions>>().Value.AdminKey;
            if (string.IsNullOrEmpty(key))
                return Results.Json(new { error = "Admin is disabled. Set Workshop:AdminKey to turn it on." }, statusCode: 503);
            if (!KeyMatches(key, ctx.HttpContext.Request, "X-Admin-Key", allowWhenUnset: false))
                return Results.Json(new { error = "Wrong admin key." }, statusCode: 401);
            return await next(ctx);
        });

        admin.MapGet("/summary", (HttpRequest http, WishStore store, ElfService elf, EventHub hub, IOptions<WorkshopOptions> o) =>
        {
            var opts = o.Value;
            var baseUrl = BaseUrl(http, opts);
            var wishes = store.AllWishes();
            return new
            {
                stats = store.GetStats(),
                claudeEnabled = elf.ClaudeEnabled,
                model = opts.Model,
                effort = opts.Effort,
                fastMode = opts.UseFastMode,
                liveScreens = hub.SubscriberCount,
                publicBaseUrl = baseUrl,
                publicBaseUrlIsLocal = IsLocal(baseUrl),
                kioskUrl = string.IsNullOrEmpty(opts.KioskKey) ? $"{baseUrl}/kiosk" : $"{baseUrl}/kiosk?key={Uri.EscapeDataString(opts.KioskKey)}",
                wallUrl = $"{baseUrl}/wall",
                counterUrl = $"{baseUrl}/counter",
                backupWishes = wishes.Count(w => w.Source == "backup"),
                averageSeconds = wishes.Where(w => w.Source == "claude").Select(w => w.ElapsedSeconds).DefaultIfEmpty(0).Average(),
            };
        });

        admin.MapGet("/wishes", (WishStore store) => store.AllWishes());

        admin.MapPost("/wishes/{id}/hidden", (string id, HiddenRequest req, WishStore store, EventHub hub) =>
        {
            if (store.SetHidden(id, req.Hidden) is null) return Results.NotFound();
            hub.Publish("refresh", new { stats = store.GetStats() });
            return Results.Ok();
        });

        admin.MapGet("/leads", (HttpRequest http, WishStore store, IOptions<WorkshopOptions> o) =>
        {
            var baseUrl = BaseUrl(http, o.Value);
            return store.AllLeads().Select(lead =>
            {
                var wish = store.GetWish(lead.WishId);
                var cardUrl = $"{baseUrl}/c/{lead.WishId}";
                return new
                {
                    lead,
                    wish = wish is null ? null : new { wish.Number, wish.Text, wish.WallText, wish.Blueprint.MachineName, wish.Category },
                    cardUrl,
                    email = wish is not null && lead.Plan is not null
                        ? EmailComposer.Compose(lead, wish, lead.Plan, cardUrl, o.Value)
                        : null,
                };
            });
        });

        admin.MapPost("/leads/{id}/sent", (string id, SentRequest req, WishStore store) =>
            store.UpdateLead(id, l => l.Sent = req.Sent) is null ? Results.NotFound() : Results.Ok());

        admin.MapPost("/leads/{id}/regenerate", (string id, WishStore store, PlanWorker worker) =>
        {
            if (store.UpdateLead(id, l => l.PlanStatus = "pending") is null) return Results.NotFound();
            worker.Enqueue(id);
            return Results.Ok();
        });

        admin.MapGet("/leads.csv", (HttpRequest http, WishStore store, IOptions<WorkshopOptions> o) =>
        {
            var baseUrl = BaseUrl(http, o.Value);
            var csv = new StringBuilder();
            csv.AppendLine("Created,Name,Email,Company,Role,Consent,Wish #,Wish,Category,Hours Saved / Year,Plan Status,Sent,Card URL,Email Subject,Email Body");
            foreach (var lead in store.AllLeads())
            {
                var wish = store.GetWish(lead.WishId);
                var cardUrl = $"{baseUrl}/c/{lead.WishId}";
                var email = wish is not null && lead.Plan is not null ? EmailComposer.Compose(lead, wish, lead.Plan, cardUrl, o.Value) : null;
                string[] row =
                [
                    lead.CreatedAt.ToString("yyyy-MM-dd HH:mm"), lead.Name, lead.Email, lead.Company, lead.Role,
                    lead.Consent ? "yes" : "no", wish?.Number.ToString() ?? "", wish?.Text ?? "", wish?.Category ?? "",
                    wish?.Practical.HoursSavedPerYear.ToString() ?? "", lead.PlanStatus, lead.Sent ? "yes" : "no", cardUrl,
                    email?.Subject ?? "", email?.Text ?? "",
                ];
                csv.AppendLine(string.Join(',', row.Select(Csv)));
            }
            return Results.File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray(),
                "text/csv", $"santas-workshop-leads-{DateTime.Now:yyyyMMdd-HHmm}.csv");
        });

        admin.MapGet("/qr", (string path, HttpRequest http, IOptions<WorkshopOptions> o) =>
            Svg(QrSvg(BaseUrl(http, o.Value) + (path.StartsWith('/') ? path : "/" + path))));
    }

    public static string BaseUrl(HttpRequest http, WorkshopOptions o) =>
        !string.IsNullOrWhiteSpace(o.PublicBaseUrl)
            ? o.PublicBaseUrl.TrimEnd('/')
            : $"{http.Scheme}://{http.Host}{http.PathBase}";

    private static bool IsLocal(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.IsLoopback || uri.Host == "localhost");

    private static bool KeyMatches(string? expected, HttpRequest http, string header, bool allowWhenUnset)
    {
        if (string.IsNullOrEmpty(expected)) return allowWhenUnset;
        var supplied = http.Headers[header].FirstOrDefault() ?? http.Query["key"].FirstOrDefault() ?? "";
        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(supplied), Encoding.UTF8.GetBytes(expected));
    }

    private static string QrSvg(string url)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        return new SvgQRCode(data).GetGraphic(10, "#0b1d33", "#ffffff", drawQuietZones: true);
    }

    private static IResult Svg(string svg) => Results.Text(svg, "image/svg+xml");

    private static string Csv(string value)
    {
        // Guests type these fields, so stop Excel from treating "=..." as a formula.
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0])) value = "'" + value;
        return value.IndexOfAny([',', '"', '\n', '\r']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }
}
