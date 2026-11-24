using System.Threading.Channels;

namespace SantasWorkshop.Services;

/// <summary>
/// Writes each lead's personalized starter plan in the background, so the phone form returns
/// instantly. Any plans still pending at startup (e.g. after a restart) are picked up again.
/// </summary>
public sealed class PlanWorker(WishStore store, ElfService elf, ILogger<PlanWorker> logger) : BackgroundService
{
    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>();

    public void Enqueue(string leadId) => _queue.Writer.TryWrite(leadId);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        foreach (var pending in store.AllLeads().Where(l => l.PlanStatus == "pending")) Enqueue(pending.Id);

        await foreach (var leadId in _queue.Reader.ReadAllAsync(stoppingToken))
        {
            var lead = store.GetLead(leadId);
            var wish = lead is null ? null : store.GetWish(lead.WishId);
            if (lead is null || wish is null) continue;

            try
            {
                var plan = await elf.WriteStarterPlanAsync(wish, lead, stoppingToken);
                store.UpdateLead(leadId, l => { l.Plan = plan; l.PlanStatus = "ready"; });
                logger.LogInformation("Starter plan ready for lead {LeadId} ({Source})", leadId, plan.Source);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Starter plan failed for lead {LeadId}", leadId);
                store.UpdateLead(leadId, l => l.PlanStatus = "failed");
            }
        }
    }
}
