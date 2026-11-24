namespace SantasWorkshop.Models;

/// <summary>A guest who scanned their card's QR code and opted in to the follow-up email.</summary>
public sealed class Lead
{
    public string Id { get; set; } = "";
    public string WishId { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string Company { get; set; } = "";
    public string Role { get; set; } = "";
    public bool Consent { get; set; }

    /// <summary>"pending", "ready" or "failed".</summary>
    public string PlanStatus { get; set; } = "pending";
    public StarterPlan? Plan { get; set; }

    /// <summary>Staff tick this once the follow-up email has gone out.</summary>
    public bool Sent { get; set; }
}

/// <summary>The personalized "AI starter plan" sent the day after the party.</summary>
public sealed class StarterPlan
{
    public string Summary { get; set; } = "";
    public List<PlanPhase> Phases { get; set; } = [];
    public List<string> DataNeeded { get; set; } = [];
    public List<string> Guardrails { get; set; } = [];
    public string SuccessMetric { get; set; } = "";
    public string Source { get; set; } = "claude";
}

public sealed class PlanPhase
{
    public string Title { get; set; } = "";
    public List<string> Items { get; set; } = [];
}
