using System.Text.RegularExpressions;
using SantasWorkshop.Models;

namespace SantasWorkshop.Services;

/// <summary>
/// Offline stand-in for Claude: keyword-matches the wish to a category and fills in a hand-written
/// template. Used when there is no API key, the venue Wi-Fi drops, or a request fails.
/// </summary>
public sealed partial class BackupElf
{
    private sealed record Template(
        string Category,
        string[] Keywords,
        string[] Names,
        string Tagline,
        (string Kind, string Label)[] Modules,
        string Fineprint,
        string Headline,
        string[] Steps,
        string[] Techniques,
        string FirstStep,
        int Hours,
        string Assumption);

    private static readonly Template[] Templates =
    [
        new("Finance & Accounting",
            ["invoice", "expense", "receipt", "reconcil", "budget", "payroll", "billing", "accounts", "payable", "receivable", "quickbooks", "tax", "purchase order", "bookkeep", "month-end", "month end", "close the books"],
            ["Receipt-o-Matic", "Ledger Sleigh", "Reconcile-inator", "Penny Pincher"],
            "Crunches numbers so you can crunch cookies.",
            [("hopper", "Receipt Swallower"), ("scanner", "Line-Item Lens"), ("brain", "Ledger Logic"), ("stamp", "Approve-o-Tron"), ("printer", "Tidy Books Out")],
            "Do not feed it fruitcake receipts. It knows.",
            "AI reads invoices and receipts, matches them to your records, and flags only the exceptions for a person to review.",
            ["Documents arrive by email or upload and AI extracts vendor, amounts, dates and line items.",
             "It matches each one against purchase orders, bank lines or policy rules.",
             "Clean matches post automatically; mismatches land in a short queue for human review."],
            ["Document extraction", "Rule-based matching", "Exception routing"],
            "Pull last month's invoices and try AI extraction on 50 of them. Measure how many match your records without a human touch.",
            520, "4 people × 3 hrs/week × 48 weeks, ~45% automated"),

        new("Sales & Marketing",
            ["proposal", "rfp", "sales", "crm", "lead", "marketing", "social media", "newsletter", "campaign", "quote", "pitch", "blog", "linkedin", "follow up", "follow-up", "prospect"],
            ["Proposal Pro-Elf", "Pitch Perfector", "Deal Sleigher", "Quote-o-Matic"],
            "Writes first drafts faster than Rudolph on espresso.",
            [("magnet", "CRM Data Grabber"), ("tank", "Past-Win Cocoa Vat"), ("brain", "Pitch Ponderer"), ("robot-arm", "Draft Typist"), ("gift-wrapper", "Bow-Tied Proposal")],
            "May over-use the word 'synergy'. Supervise accordingly.",
            "AI drafts proposals and follow-ups from your past wins and CRM notes, so reps spend their time editing and selling instead of starting from scratch.",
            ["AI searches your past proposals, case studies and pricing for relevant material.",
             "It drafts a tailored first version using the prospect's details from your CRM.",
             "A salesperson reviews, edits and sends; the final version feeds back into the library."],
            ["Search over company docs", "Drafting with approval", "CRM integration"],
            "Gather your ten best recent proposals into one folder and have AI draft the next one from them. Compare the time against your usual process.",
            640, "5 reps × 3 hrs/week × 48 weeks, ~45% faster"),

        new("Customer Service",
            ["support", "ticket", "customer", "triag", "complaint", "help desk", "helpdesk", "phone call", "faq", "inquir", "service request", "returns", "chat"],
            ["Triage-a-Tron", "Inbox Elf-o-Matic", "Ticket Tamer", "Help-Desk Helper"],
            "Sorts the naughty tickets from the nice ones.",
            [("hopper", "Inbox Intake"), ("brain", "Mood Reader"), ("sorter", "Naughty/Nice Chutes"), ("robot-arm", "Reply Drafter"), ("bell", "Human Alert Bell")],
            "Escalates anything that mentions coal.",
            "AI reads incoming requests, tags and routes them, and drafts replies from your knowledge base, so agents handle the tricky ones instead of sorting.",
            ["Each new ticket or email is classified by topic, urgency and sentiment.",
             "AI drafts a reply using your help articles and past resolved tickets.",
             "Agents approve or edit drafts; urgent or upset customers go straight to a person."],
            ["Classification and routing", "Q&A over help docs", "Drafting with approval"],
            "Export 200 recent tickets and test whether AI tags and routes them the way your best agent would.",
            780, "5 agents × 4 hrs/week × 48 weeks, ~40% automated"),

        new("HR & People",
            ["onboard", "hiring", "resume", "recruit", "interview", "benefit", "pto", "timesheet", "performance review", "training", "job description", "candidate", "employee handbook"],
            ["Onboard-o-Matic", "Hire-a-Helper 3000", "Elf Resources Engine", "Welcome Wagon Bot"],
            "Gets new elves productive before the cocoa cools.",
            [("hopper", "Paperwork Funnel"), ("scanner", "Resume Reader"), ("tank", "Handbook Reservoir"), ("antenna", "Reminder Beacon"), ("gift-wrapper", "Welcome Packet")],
            "Will not schedule interviews on Christmas Day. Probably.",
            "AI answers routine HR questions from your handbook, drafts onboarding checklists, and summarizes candidates, so HR spends time on people instead of paperwork.",
            ["Employees ask policy questions in chat and get answers cited from your handbook.",
             "New-hire checklists and welcome emails are generated and tracked automatically.",
             "Recruiters get structured candidate summaries, while humans make every hiring decision."],
            ["Q&A over policies", "Document generation", "Summarization"],
            "Load your employee handbook into a pilot assistant and let three managers try it for policy questions for a month.",
            420, "3 HR staff × 3 hrs/week × 48 weeks, ~50% automated"),

        new("Operations",
            ["inventory", "shipping", "order", "logistic", "vendor", "supply", "work order", "dispatch", "production", "warehouse", "routing", "maintenance", "procurement", "fleet"],
            ["Sleigh-Route Optimizer", "Workshop Flow-Matic", "Inventory Elf 9000", "Order Orchestrator"],
            "Keeps the workshop humming and the sleigh on time.",
            [("magnet", "Order Puller"), ("gears", "Workflow Gearbox"), ("brain", "Forecast Globe"), ("conveyor", "Smooth Belt"), ("bell", "Shortage Jingle")],
            "Not responsible for reindeer union negotiations.",
            "AI watches orders, inventory and schedules, forecasts what is coming, and handles routine updates so your team only steps in on exceptions.",
            ["Connect order, inventory and scheduling data into one view.",
             "AI forecasts demand, spots shortages early and suggests reorders or schedule changes.",
             "Routine updates go out automatically; planners approve anything unusual."],
            ["Forecasting", "Workflow automation", "Anomaly alerts"],
            "Pick one recurring weekly ops report and automate it end to end, with a person checking the output for the first month.",
            690, "5 people × 3 hrs/week × 48 weeks, ~50% automated"),

        new("IT & Software",
            ["password", "reset", "code", "bug", "deploy", "testing", "documentation", "patch", "server", "it ticket", "access request", "software", "laptop", "setup"],
            ["Bug-Squash Sleigh", "Helpdesk Elf 404", "Patch-a-Tron", "Code Cookie Cutter"],
            "Turns it off and on again with festive enthusiasm.",
            [("hopper", "Ticket Chute"), ("brain", "Stack-Trace Snowglobe"), ("robot-arm", "Fix-It Arm"), ("stamp", "Change Approval"), ("rocket", "Deploy Booster")],
            "Has never once been asked to fix the printer. Do not start.",
            "AI resolves routine IT requests, writes and reviews code and documentation, and drafts fixes, while engineers keep final approval on anything that ships.",
            ["Common requests like access and resets are handled by an assistant with guardrails.",
             "Developers use AI to draft code, tests and docs, then review every change.",
             "Recurring incidents are summarized with likely causes so fixes come faster."],
            ["AI coding assistants", "Self-service automation", "Incident summarization"],
            "List your top five repetitive IT tickets and automate the safest one with an approval step.",
            850, "6 people × 3 hrs/week × 48 weeks, ~50% automated"),

        new("Email & Admin",
            ["email", "inbox", "meeting", "notes", "calendar", "schedul", "minutes", "data entry", "filing", "paperwork", "form", "agenda", "voicemail", "copy and paste", "copy-paste"],
            ["Inbox Zero-inator", "Minute-Taker 3000", "Paperwork Plower", "Calendar Elf"],
            "Clears your inbox like a snowplow clears Division Street.",
            [("hopper", "Inbox Funnel"), ("scanner", "Skim-o-Scope"), ("sorter", "Priority Chutes"), ("robot-arm", "Reply Drafter"), ("chimney", "Busywork Vent")],
            "May unsubscribe you from things you secretly liked.",
            "AI summarizes meetings and long threads, drafts routine replies, and pulls data out of forms, so you get your afternoons back.",
            ["Meetings are transcribed and summarized with decisions and action items.",
             "Incoming email is sorted by priority, with drafts ready for routine replies.",
             "Form and document data is extracted into your systems instead of being retyped."],
            ["Summarization", "Drafting with approval", "Data extraction"],
            "Turn on AI meeting summaries for one team's recurring meetings for 30 days and track the time saved on notes and follow-ups.",
            600, "5 people × 2.5 hrs/week × 48 weeks, ~50% automated"),

        new("Reports & Data",
            ["report", "dashboard", "spreadsheet", "excel", "data", "metric", "kpi", "analysis", "status update", "pivot", "numbers", "forecast"],
            ["Report-o-Matic", "Spreadsheet Sleigh", "KPI Kringle", "Dashboard Dasher"],
            "Makes the numbers jingle all the way.",
            [("magnet", "Data Collector"), ("tank", "Number Nog Tank"), ("brain", "Insight Globe"), ("printer", "Report Press"), ("antenna", "Send-to-Boss")],
            "Charts may contain traces of tinsel.",
            "AI pulls data from your systems, builds the recurring report, and writes a plain-English summary of what changed, so people discuss results instead of assembling them.",
            ["Data from your systems is collected on a schedule into one source.",
             "The report and charts are generated automatically, with AI writing the narrative.",
             "An owner reviews the summary and anyone can ask follow-up questions in plain English."],
            ["Data integration", "Narrative generation", "Natural-language Q&A"],
            "Pick the report that takes longest to assemble each month and automate the data pull plus a draft summary.",
            480, "4 people × 2.5 hrs/week × 48 weeks, ~50% automated"),

        new("Legal & Compliance",
            ["contract", "clause", "legal", "compliance", "policy", "nda", "regulat", "audit", "safety", "osha", "hipaa", "terms", "redline"],
            ["Contract Comb-o-Matic", "Clause Claus", "Compliance Candy Cane", "Redline Reindeer"],
            "Reads the fine print so you don't have to squint.",
            [("hopper", "Contract Chute"), ("scanner", "Clause Finder"), ("tank", "Policy Reservoir"), ("bell", "Risk Jingle"), ("stamp", "Lawyer-Approved")],
            "Not a lawyer. Did go to elf law school for one semester.",
            "AI reviews contracts and policies against your standard positions, highlights risky clauses, and drafts summaries, with your legal team making the calls.",
            ["Incoming contracts are compared against your standard terms and playbook.",
             "AI flags unusual or risky clauses and suggests standard alternatives.",
             "A reviewer approves the redlines; summaries are stored for later search."],
            ["Clause extraction", "Comparison to playbook", "Summarization"],
            "Write down your five must-check clauses and test AI review on ten recent NDAs or vendor contracts.",
            360, "2 people × 4 hrs/week × 48 weeks, ~45% automated"),

        new("Holiday Magic",
            ["present", "gift", "wrap", "christmas", "cookie", "shopping", "shovel", "snow", "dishes", "laundry", "holiday card", "decorat", "tree", "lights"],
            ["Wrap-o-Matic 5000", "Cookie Calculator", "Snow-Be-Gone Sleigh", "Tinsel Turbo"],
            "Because some wishes are just for fun.",
            [("hopper", "Gift Gobbler"), ("gears", "Tape Twister"), ("conveyor", "Present Parade"), ("gift-wrapper", "Bow Blaster"), ("rocket", "Chimney Express")],
            "Will wrap the cat if left unattended.",
            "The same AI that plans holiday chores can plan work: it turns a pile of to-dos into a prioritized list with drafts ready for each one.",
            ["Gather every request from email, chat and sticky notes into one list.",
             "AI groups, prioritizes and drafts the first step for each item.",
             "You review the plan each morning and send what is ready."],
            ["Task extraction", "Prioritization", "Drafting with approval"],
            "Try an AI assistant on your own inbox for a week: have it pull out every to-do and draft the easy replies.",
            150, "1 person × 1 hr/week × 48 weeks, ~60% automated"),
    ];

    private static readonly Template Generic = new(
        Catalog.FallbackCategory, [],
        ["Busywork Buster 3000", "Elf-ficiency Engine", "Task-Be-Gone Sleigh", "To-Do Dasher"],
        "Turns tedious tasks into tinsel.",
        [("hopper", "Task Intake"), ("brain", "Thinky Snowglobe"), ("gears", "Grind Gears"), ("robot-arm", "Helping Hand"), ("gift-wrapper", "Done & Wrapped")],
        "Results may cause unexpected free time.",
        "AI can take the repetitive, rules-based parts of this task, draft the rest for review, and hand people only the decisions that need judgment.",
        ["Map the task step by step and mark which steps follow clear rules.",
         "Let AI handle the rule-following steps and draft the ones that need a writer.",
         "People review drafts and handle exceptions, and their feedback improves the system."],
        ["Workflow automation", "Drafting with approval", "Exception handling"],
        "Time this task for one week, then pilot AI on its most repetitive step and compare.",
        400, "5 people × 2 hrs/week × 48 weeks, ~40% automated");

    public ElfAnswer GrantWish(string text)
    {
        var lower = text.ToLowerInvariant();
        var template = Templates
            .Select(t => (t, score: t.Keywords.Count(k => lower.Contains(k))))
            .Where(x => x.score > 0)
            .OrderByDescending(x => x.score)
            .Select(x => x.t)
            .FirstOrDefault() ?? Generic;

        // Stable per wish text so the same wish gets the same machine.
        var seed = (int)(StableHash(text) & 0x7fffffff);
        var name = template.Names[seed % template.Names.Length];
        var number = 1000 * (2 + seed % 8);
        var hours = (int)Math.Round(template.Hours * (0.85 + (seed % 31) / 100.0) / 10.0) * 10;

        return new ElfAnswer
        {
            Appropriate = true,
            WallText = ToWallText(text),
            Category = template.Category,
            Blueprint = new Blueprint
            {
                MachineName = name.Any(char.IsDigit) ? $"The {name}" : $"The {name} {number}",
                Tagline = template.Tagline,
                Modules = template.Modules.Select(m => new BlueprintModule { Kind = m.Kind, Label = m.Label }).ToList(),
                Fineprint = template.Fineprint,
            },
            Practical = new PracticalPlan
            {
                Headline = template.Headline,
                Steps = [.. template.Steps],
                Techniques = [.. template.Techniques],
                FirstStep = template.FirstStep,
                HoursSavedPerYear = hours,
                HoursAssumption = template.Assumption,
            },
        };
    }

    public StarterPlan WriteStarterPlan(Wish wish) => new()
    {
        Source = "backup",
        Summary = $"{wish.Practical.Headline} Start small with one well-defined slice of the work, keep a person reviewing the output, and expand once the numbers prove it out.",
        Phases =
        [
            new() { Title = "Days 1–30: Map it and pick a pilot", Items =
                [ "Time the task for two weeks and note every step and system it touches.",
                  wish.Practical.FirstStep,
                  "Choose one success measure, such as hours per week or turnaround time." ] },
            new() { Title = "Days 31–60: Run the pilot with a human in the loop", Items =
                [ "Run AI on real work, with a person approving every output.",
                  "Log what it gets right and wrong, and tune instructions and examples weekly." ] },
            new() { Title = "Days 61–90: Measure and decide", Items =
                [ "Compare time and quality against your baseline from the first month.",
                  "Decide whether to expand, adjust or stop, and plan the integration work for a full rollout." ] },
        ],
        DataNeeded =
        [
            "20–50 real examples of the work, both typical and tricky",
            "Any written rules, templates or policies people follow today",
            "Access to the systems the work starts in and ends up in",
        ],
        Guardrails =
        [
            "A person reviews every output during the pilot",
            "Keep customer and employee data inside approved, secured tools",
            "Spot-check accuracy weekly against a sample done by hand",
        ],
        SuccessMetric = $"The pilot works if it saves at least a third of the time on the piloted slice with no drop in quality, on track for about {wish.Practical.HoursSavedPerYear:N0} hours a year.",
    };

    public static List<BlueprintModule> DefaultModules() =>
        Generic.Modules.Select(m => new BlueprintModule { Kind = m.Kind, Label = m.Label }).ToList();

    /// <summary>Best-effort phrase that completes "I wish AI would …".</summary>
    public static string ToWallText(string text)
    {
        var s = WishPrefix().Replace(text.Trim(), "");
        s = Regex.Replace(s, @"\s+", " ").Trim().TrimEnd('.', '!', '?', '…');
        var words = s.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length > 9) s = string.Join(' ', words.Take(9)) + "…";
        if (s.Length > 70) s = s[..69].TrimEnd() + "…";
        if (s.Length == 0) return "take care of the busywork";
        return char.ToLowerInvariant(s[0]) + s[1..];
    }

    [GeneratedRegex(@"^(i\s+wish\s+)?((ai|it|someone|something|santa)\s+(would|could)\s+)?(just\s+)?", RegexOptions.IgnoreCase)]
    private static partial Regex WishPrefix();

    private static uint StableHash(string s)
    {
        uint hash = 2166136261;
        foreach (var c in s) hash = (hash ^ c) * 16777619;
        return hash;
    }
}
