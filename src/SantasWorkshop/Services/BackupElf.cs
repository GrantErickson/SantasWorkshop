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
        string Assumption,
        (string Icon, string Text)[] Tldr);

    private static readonly Template[] Templates =
    [
        new("Finance & Accounting",
            ["invoice", "expense", "receipt", "reconcil", "budget", "payroll", "billing", "accounts", "payable", "receivable", "quickbooks", "tax", "purchase order", "bookkeep", "month-end", "month end", "close the books"],
            ["Receipt-o-Matic", "Ledger Sleigh", "Reconcile-inator", "Penny Pincher"],
            "Crunches numbers so you can crunch cookies.",
            [("hopper", "Receipt Swallower"), ("scanner", "Line-Item Lens"), ("calculator", "Ledger Cruncher"), ("stamp", "Approve-o-Tron"), ("filing-cabinet", "Tidy Books Drawer")],
            "Do not feed it fruitcake receipts. It knows.",
            "AI matches invoices and receipts to your records and flags only the exceptions.",
            ["Invoices arrive and AI reads vendor, amount, date",
             "It matches each to purchase orders and bank lines",
             "Clean matches post; a person reviews the rest"],
            ["Document extraction", "Rule-based matching", "Exception routing"],
            "Run AI extraction on 50 of last month's invoices and count how many match with no human touch.",
            520, "4 people × 3 hrs/week × 48 weeks, ~45% automated",
            [("🧾", "Invoices come in"), ("🤖", "AI matches them"), ("✅", "You OK exceptions")]),

        new("Sales & Marketing",
            ["proposal", "rfp", "sales", "crm", "lead", "marketing", "social media", "newsletter", "campaign", "quote", "pitch", "blog", "linkedin", "follow up", "follow-up", "prospect"],
            ["Proposal Pro-Elf", "Pitch Perfector", "Deal Sleigher", "Quote-o-Matic"],
            "Writes first drafts faster than Rudolph on espresso.",
            [("magnet", "CRM Data Grabber"), ("tank", "Past-Win Cocoa Vat"), ("lightbulb", "Pitch Idea Bulb"), ("robot-arm", "Draft Typist"), ("gift-wrapper", "Bow-Tied Proposal")],
            "May over-use the word 'synergy'. Supervise accordingly.",
            "AI drafts proposals from your past wins, so reps edit instead of starting cold.",
            ["AI finds relevant past proposals and pricing",
             "It drafts a tailored version from CRM details",
             "A rep edits and sends; wins feed the library"],
            ["Search over company docs", "Drafting with approval", "CRM integration"],
            "Put your ten best recent proposals in one folder, have AI draft the next one, and time it.",
            640, "5 reps × 3 hrs/week × 48 weeks, ~45% faster",
            [("📇", "Prospect details in"), ("✍️", "AI drafts the proposal"), ("🤝", "Reps edit and send")]),

        new("Customer Service",
            ["support", "ticket", "customer", "triag", "complaint", "help desk", "helpdesk", "phone call", "faq", "inquir", "service request", "returns", "chat"],
            ["Triage-a-Tron", "Inbox Elf-o-Matic", "Ticket Tamer", "Help-Desk Helper"],
            "Sorts the naughty tickets from the nice ones.",
            [("mailbox", "Inbox Intake"), ("sorter", "Naughty/Nice Chutes"), ("chatbot", "Reply Bubbles"), ("helper-bot", "Help-Desk Elf-Bot"), ("bell", "Human Alert Bell")],
            "Escalates anything that mentions coal.",
            "AI sorts tickets and drafts replies, so agents only handle the tricky ones.",
            ["AI tags each ticket by topic, urgency and mood",
             "It drafts a reply from your help articles",
             "Agents OK drafts; upset customers reach a person"],
            ["Classification and routing", "Q&A over help docs", "Drafting with approval"],
            "Export 200 recent tickets and test whether AI tags and routes them the way your best agent would.",
            780, "5 agents × 4 hrs/week × 48 weeks, ~40% automated",
            [("📨", "Requests pour in"), ("🤖", "AI sorts and drafts"), ("🙋", "Agents take tricky ones")]),

        new("HR & People",
            ["onboard", "hiring", "resume", "recruit", "interview", "benefit", "pto", "timesheet", "performance review", "training", "job description", "candidate", "employee handbook"],
            ["Onboard-o-Matic", "Hire-a-Helper 3000", "Elf Resources Engine", "Welcome Wagon Bot"],
            "Gets new elves productive before the cocoa cools.",
            [("hopper", "Paperwork Funnel"), ("scanner", "Resume Reader"), ("filing-cabinet", "Handbook Drawers"), ("clock", "Reminder Clock"), ("gift-wrapper", "Welcome Packet")],
            "Will not schedule interviews on Christmas Day. Probably.",
            "AI answers HR questions and drafts onboarding, so HR spends time on people.",
            ["Staff get policy answers cited from the handbook",
             "New-hire checklists and welcomes are drafted",
             "Recruiters get candidate summaries; people decide"],
            ["Q&A over policies", "Document generation", "Summarization"],
            "Load your handbook into a pilot assistant and let three managers use it for a month.",
            420, "3 HR staff × 3 hrs/week × 48 weeks, ~50% automated",
            [("❓", "Routine HR questions"), ("📖", "AI answers from handbook"), ("💛", "HR focuses on people")]),

        new("Operations",
            ["inventory", "shipping", "order", "logistic", "vendor", "supply", "work order", "dispatch", "production", "warehouse", "routing", "maintenance", "procurement", "fleet"],
            ["Sleigh-Route Optimizer", "Workshop Flow-Matic", "Inventory Elf 9000", "Order Orchestrator"],
            "Keeps the workshop humming and the sleigh on time.",
            [("crane", "Order Picker"), ("gears", "Workflow Gearbox"), ("crystal-ball", "Forecast Globe"), ("conveyor", "Smooth Belt"), ("bell", "Shortage Jingle")],
            "Not responsible for reindeer union negotiations.",
            "AI forecasts demand, handles routine updates, and leaves exceptions to people.",
            ["Orders, stock and schedules flow into one view",
             "AI forecasts demand and suggests reorders early",
             "Routine updates go out; planners OK the unusual"],
            ["Forecasting", "Workflow automation", "Anomaly alerts"],
            "Automate one recurring weekly ops report end to end, with a person checking it for a month.",
            690, "5 people × 3 hrs/week × 48 weeks, ~50% automated",
            [("📦", "Orders and inventory"), ("🔮", "AI forecasts and flags"), ("🧑‍🔧", "Team handles exceptions")]),

        new("IT & Software",
            ["password", "reset", "code", "bug", "deploy", "testing", "documentation", "patch", "server", "it ticket", "access request", "software", "laptop", "setup"],
            ["Bug-Squash Sleigh", "Helpdesk Elf 404", "Patch-a-Tron", "Code Cookie Cutter"],
            "Turns it off and on again with festive enthusiasm.",
            [("hopper", "Ticket Chute"), ("helper-bot", "Reset-Bot 404"), ("robot-arm", "Fix-It Arm"), ("tesla-coil", "Patch Zapper"), ("rocket", "Deploy Booster")],
            "Has never once been asked to fix the printer. Do not start.",
            "AI handles routine IT requests and drafts code; engineers approve what ships.",
            ["An assistant handles resets and access requests",
             "Developers draft code, tests and docs with AI",
             "Recurring incidents come with likely causes"],
            ["AI coding assistants", "Self-service automation", "Incident summarization"],
            "List your top five repetitive IT tickets and automate the safest one with an approval step.",
            850, "6 people × 3 hrs/week × 48 weeks, ~50% automated",
            [("🎫", "IT requests and code"), ("🤖", "AI drafts the fixes"), ("👩‍💻", "Engineers approve")]),

        new("Email & Admin",
            ["email", "inbox", "meeting", "notes", "calendar", "schedul", "minutes", "data entry", "filing", "paperwork", "form", "agenda", "voicemail", "copy and paste", "copy-paste"],
            ["Inbox Zero-inator", "Minute-Taker 3000", "Paperwork Plower", "Calendar Elf"],
            "Clears your inbox like a snowplow clears Division Street.",
            [("mailbox", "Inbox Funnel"), ("vacuum", "Note Hoover"), ("sorter", "Priority Chutes"), ("robot-arm", "Reply Drafter"), ("shredder", "Busywork Shredder")],
            "May unsubscribe you from things you secretly liked.",
            "AI summarizes meetings and drafts routine replies, so you get afternoons back.",
            ["Meetings are summarized with decisions and to-dos",
             "Email is sorted by priority, with replies drafted",
             "Form data flows into your systems, not retyped"],
            ["Summarization", "Drafting with approval", "Data extraction"],
            "Turn on AI meeting summaries for one team for 30 days and track the time saved.",
            600, "5 people × 2.5 hrs/week × 48 weeks, ~50% automated",
            [("📬", "Threads and meetings"), ("📝", "AI summarizes and drafts"), ("☕", "Afternoons back")]),

        new("Reports & Data",
            ["report", "dashboard", "spreadsheet", "excel", "data", "metric", "kpi", "analysis", "status update", "pivot", "numbers", "forecast"],
            ["Report-o-Matic", "Spreadsheet Sleigh", "KPI Kringle", "Dashboard Dasher"],
            "Makes the numbers jingle all the way.",
            [("vacuum", "Data Hoover"), ("spreadsheet", "Cell Filler 5000"), ("brain", "Insight Globe"), ("printer", "Report Press"), ("catapult", "Send-to-Boss")],
            "Charts may contain traces of tinsel.",
            "AI builds your recurring report and explains what changed in plain English.",
            ["Data is pulled from your systems on a schedule",
             "AI builds the charts and writes the story",
             "An owner reviews; anyone can ask follow-ups"],
            ["Data integration", "Narrative generation", "Natural-language Q&A"],
            "Pick the report that takes longest to assemble each month and automate the data pull plus a draft summary.",
            480, "4 people × 2.5 hrs/week × 48 weeks, ~50% automated",
            [("🗄️", "Data from your systems"), ("📊", "AI builds the report"), ("💬", "People discuss results")]),

        new("Legal & Compliance",
            ["contract", "clause", "legal", "compliance", "policy", "nda", "regulat", "audit", "safety", "osha", "hipaa", "terms", "redline"],
            ["Contract Comb-o-Matic", "Clause Claus", "Compliance Candy Cane", "Redline Reindeer"],
            "Reads the fine print so you don't have to squint.",
            [("hopper", "Contract Chute"), ("telescope", "Clause Spotter"), ("vault", "Policy Vault"), ("bell", "Risk Jingle"), ("stamp", "Lawyer-Approved")],
            "Not a lawyer. Did go to elf law school for one semester.",
            "AI checks contracts against your standards and flags risky clauses for legal.",
            ["Contracts are compared to your standard terms",
             "AI flags risky clauses and suggests alternatives",
             "A reviewer approves redlines; summaries are saved"],
            ["Clause extraction", "Comparison to playbook", "Summarization"],
            "Write down your five must-check clauses and test AI review on ten recent NDAs or vendor contracts.",
            360, "2 people × 4 hrs/week × 48 weeks, ~45% automated",
            [("📄", "Contracts come in"), ("🔍", "AI flags risky clauses"), ("⚖️", "Lawyers make the calls")]),

        new("Holiday Magic",
            ["present", "gift", "wrap", "christmas", "cookie", "shopping", "shovel", "snow", "dishes", "laundry", "holiday card", "decorat", "tree", "lights"],
            ["Wrap-o-Matic 5000", "Cookie Calculator", "Snow-Be-Gone Sleigh", "Tinsel Turbo"],
            "Because some wishes are just for fun.",
            [("elf-wheel", "Elf Power Wheel"), ("gears", "Tape Twister"), ("conveyor", "Present Parade"), ("gift-wrapper", "Bow Blaster"), ("rocket", "Chimney Express")],
            "Will wrap the cat if left unattended.",
            "The same AI can turn your to-do pile into a ranked list with drafts ready.",
            ["Requests from email and chat land in one list",
             "AI groups, ranks and drafts a first step for each",
             "You review each morning and send what's ready"],
            ["Task extraction", "Prioritization", "Drafting with approval"],
            "Try an AI assistant on your own inbox for a week: have it pull out every to-do and draft the easy replies.",
            150, "1 person × 1 hr/week × 48 weeks, ~60% automated",
            [("📝", "Pile of to-dos"), ("🤖", "AI sorts and drafts"), ("🎁", "You send what's ready")]),
    ];

    private static readonly Template Generic = new(
        Catalog.FallbackCategory, [],
        ["Busywork Buster 3000", "Elf-ficiency Engine", "Task-Be-Gone Sleigh", "To-Do Dasher"],
        "Turns tedious tasks into tinsel.",
        [("hopper", "Task Intake"), ("brain", "Thinky Snowglobe"), ("gears", "Grind Gears"), ("robot-arm", "Helping Hand"), ("gift-wrapper", "Done & Wrapped")],
        "Results may cause unexpected free time.",
        "AI takes the rule-based parts, drafts the rest, and leaves judgment to people.",
        ["Map the task and mark the steps with clear rules",
         "AI does the rule steps and drafts the writing",
         "People review drafts and handle exceptions"],
        ["Workflow automation", "Drafting with approval", "Exception handling"],
        "Time this task for one week, then pilot AI on its most repetitive step and compare.",
        400, "5 people × 2 hrs/week × 48 weeks, ~40% automated",
        [("📥", "Repetitive work in"), ("🤖", "AI does the routine"), ("🙌", "People make the calls")]);

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
                Tldr = template.Tldr.Select(b => new TldrBeat { Icon = b.Icon, Text = b.Text }).ToList(),
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
