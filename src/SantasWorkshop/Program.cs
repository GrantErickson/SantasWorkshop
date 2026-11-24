using System.Threading.RateLimiting;
using SantasWorkshop;
using SantasWorkshop.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<WorkshopOptions>(builder.Configuration.GetSection(WorkshopOptions.Section));
builder.Services.AddSingleton<WishStore>();
builder.Services.AddSingleton<EventHub>();
builder.Services.AddSingleton<BackupElf>();
builder.Services.AddSingleton<ElfService>();
builder.Services.AddSingleton<PlanWorker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<PlanWorker>());

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    static string Ip(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    // A busy kiosk makes a wish every 30 seconds or so; this only stops runaway scripts.
    options.AddPolicy("wish", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1) }));
    options.AddPolicy("lead", ctx => RateLimitPartition.GetFixedWindowLimiter(Ip(ctx),
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
});

var app = builder.Build();

app.UseForwardedHeaders(new() { ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.All });
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    // TVs stay open all night; make sure they pick up edits on refresh.
    OnPrepareResponse = ctx => ctx.Context.Response.Headers.CacheControl = "no-cache",
});
app.UseRateLimiter();
app.MapWorkshop();

app.Run();
