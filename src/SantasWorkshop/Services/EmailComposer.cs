using System.Net;
using System.Text;
using SantasWorkshop.Models;

namespace SantasWorkshop.Services;

/// <summary>Builds the day-after follow-up email (subject, HTML and plain text) for a lead.</summary>
public static class EmailComposer
{
    public sealed record Email(string To, string Subject, string Html, string Text);

    public static Email Compose(Lead lead, Wish wish, StarterPlan plan, string cardUrl, WorkshopOptions o)
    {
        var first = FirstName(lead.Name);
        var subject = $"Your AI starter plan from Santa's AI Workshop: {Capitalize(wish.WallText)}";
        static string E(string s) => WebUtility.HtmlEncode(s);

        var html = new StringBuilder();
        html.Append("<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d2433;max-width:640px\">");
        html.Append($"<p>Hi {E(first)},</p>");
        html.Append($"<p>Thanks for stopping by Santa's AI Workshop at the {E(o.EventName)}! You told our elf you wish AI would <b>{E(wish.WallText)}</b>. ");
        html.Append($"Here is the starter plan we promised. Your blueprint for <b>{E(wish.Blueprint.MachineName)}</b> is still online at <a href=\"{E(cardUrl)}\">{E(cardUrl)}</a>.</p>");
        html.Append($"<h2 style=\"font-size:18px;color:#0f3d6e;margin:24px 0 8px\">The big idea</h2><p>{E(plan.Summary)}</p>");
        html.Append($"<p style=\"background:#f2f6fb;border-left:4px solid #0f3d6e;padding:10px 14px\"><b>Estimated time back:</b> about {wish.Practical.HoursSavedPerYear:N0} hours a year <span style=\"color:#5b6478\">({E(wish.Practical.HoursAssumption)})</span></p>");
        html.Append("<h2 style=\"font-size:18px;color:#0f3d6e;margin:24px 0 8px\">Your first 90 days</h2>");
        foreach (var phase in plan.Phases)
        {
            html.Append($"<p style=\"margin:12px 0 4px\"><b>{E(phase.Title)}</b></p><ul style=\"margin:0 0 8px\">");
            foreach (var item in phase.Items) html.Append($"<li>{E(item)}</li>");
            html.Append("</ul>");
        }
        AppendList(html, "What you'll need", plan.DataNeeded);
        AppendList(html, "Guardrails", plan.Guardrails);
        html.Append($"<h2 style=\"font-size:18px;color:#0f3d6e;margin:24px 0 8px\">How you'll know it worked</h2><p>{E(plan.SuccessMetric)}</p>");
        html.Append($"<p style=\"margin-top:24px\">If you'd like a hand turning this into a working pilot, just reply to this email. We'd be glad to help {E(string.IsNullOrWhiteSpace(lead.Company) ? "your team" : lead.Company)} get some of those hours back.</p>");
        html.Append($"<p>Happy holidays,<br>The {E(o.CompanyName)} team<br><a href=\"{E(o.CompanyUrl)}\">{E(o.CompanyUrl)}</a></p>");
        html.Append("</div>");

        var text = new StringBuilder();
        text.AppendLine($"Hi {first},").AppendLine();
        text.AppendLine($"Thanks for stopping by Santa's AI Workshop at the {o.EventName}! You told our elf you wish AI would {wish.WallText}. Here is the starter plan we promised. Your blueprint for {wish.Blueprint.MachineName} is still online at {cardUrl}").AppendLine();
        text.AppendLine("THE BIG IDEA").AppendLine(plan.Summary).AppendLine();
        text.AppendLine($"Estimated time back: about {wish.Practical.HoursSavedPerYear:N0} hours a year ({wish.Practical.HoursAssumption})").AppendLine();
        text.AppendLine("YOUR FIRST 90 DAYS");
        foreach (var phase in plan.Phases)
        {
            text.AppendLine(phase.Title);
            foreach (var item in phase.Items) text.AppendLine($"  - {item}");
        }
        text.AppendLine().AppendLine("WHAT YOU'LL NEED");
        foreach (var item in plan.DataNeeded) text.AppendLine($"  - {item}");
        text.AppendLine().AppendLine("GUARDRAILS");
        foreach (var item in plan.Guardrails) text.AppendLine($"  - {item}");
        text.AppendLine().AppendLine("HOW YOU'LL KNOW IT WORKED").AppendLine(plan.SuccessMetric).AppendLine();
        text.AppendLine("If you'd like a hand turning this into a working pilot, just reply to this email.").AppendLine();
        text.AppendLine("Happy holidays,").AppendLine($"The {o.CompanyName} team").AppendLine(o.CompanyUrl);

        return new Email(lead.Email, subject, html.ToString(), text.ToString());
    }

    private static void AppendList(StringBuilder html, string heading, List<string> items)
    {
        if (items.Count == 0) return;
        html.Append($"<h2 style=\"font-size:18px;color:#0f3d6e;margin:24px 0 8px\">{WebUtility.HtmlEncode(heading)}</h2><ul>");
        foreach (var item in items) html.Append($"<li>{WebUtility.HtmlEncode(item)}</li>");
        html.Append("</ul>");
    }

    private static string FirstName(string name)
    {
        var first = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        return string.IsNullOrEmpty(first) ? "there" : first;
    }

    private static string Capitalize(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s[1..];
}
