namespace SantasWorkshop.Models;

/// <summary>
/// Fixed vocabularies shared by the prompt, the JSON schema, the backup elf and the front end.
/// Module kinds must match the drawings in wwwroot/js/blueprint.js.
/// </summary>
public static class Catalog
{
    public const string FallbackCategory = "Other";

    public static readonly string[] Categories =
    [
        "Finance & Accounting",
        "Sales & Marketing",
        "Customer Service",
        "HR & People",
        "Operations",
        "IT & Software",
        "Email & Admin",
        "Reports & Data",
        "Legal & Compliance",
        "Holiday Magic",
        FallbackCategory,
    ];

    /// <summary>Machine parts the blueprint renderer knows how to draw, with a hint for the model.</summary>
    public static readonly (string Kind, string Hint)[] Modules =
    [
        ("hopper", "funnel that takes the work in"),
        ("magnet", "pulls data in from other systems"),
        ("scanner", "magnifying lens that reads documents"),
        ("brain", "snow-globe AI brain that thinks it over"),
        ("gears", "gearbox that grinds through the busywork"),
        ("sorter", "chutes that route items into the right bins"),
        ("robot-arm", "arm that does the clicking and typing"),
        ("conveyor", "belt that moves items along"),
        ("stamp", "press that approves or stamps"),
        ("tank", "cocoa tank that stores knowledge or data"),
        ("bell", "jingle bell that rings an alarm when something urgent happens"),
        ("antenna", "candy-cane antenna that sends messages"),
        ("printer", "prints reports and documents"),
        ("gift-wrapper", "wraps and delivers the finished result"),
        ("chimney", "vents the busywork away"),
        ("rocket", "booster for extra speed"),
        ("shredder", "shreds the paperwork nobody needs"),
        ("mailbox", "sends the emails and letters"),
        ("calculator", "crunches the numbers"),
        ("clock", "keeps schedules and deadlines"),
        ("crystal-ball", "forecasts what's coming next"),
        ("lightbulb", "comes up with bright ideas"),
        ("elf-wheel", "hamster wheel an elf runs in to power the machine"),
        ("catapult", "flings finished work out the door"),
        ("crane", "claw that picks exactly the right item"),
        ("vacuum", "hoovers up scattered data"),
        ("filing-cabinet", "files everything where it belongs"),
        ("tesla-coil", "candy-cane coil that zaps tasks with power"),
        ("telescope", "searches far and wide"),
        ("chatbot", "speech bubbles that answer questions"),
        ("helper-bot", "friendly robot elf that handles routine requests"),
        ("spreadsheet", "grid that fills in every cell"),
        ("vault", "keeps secrets and records safe"),
        ("sleigh", "delivers the finished work to the right people"),
        ("snowplow", "clears out a huge backlog"),
        ("cookie-cutter", "turns messy input into a neat standard template"),
        ("sieve", "filters out spam, junk and duplicates"),
        ("phonograph", "listens to calls or meetings and writes them down"),
        ("typewriter", "types up letters, drafts and documents"),
        ("scale", "weighs options, compares bids, checks things balance"),
        ("radar", "keeps watch for changes, problems or anomalies"),
        ("switchboard", "connects each request to the right person"),
        ("piggy-bank", "tracks spending, budgets and savings"),
        ("compass", "plans routes, priorities and next steps"),
        ("tag-gun", "tags, labels and categorizes everything"),
        ("clipboard", "checklist that ticks off every requirement"),
        ("sewing-machine", "stitches data from different systems together"),
        ("eraser", "fixes typos and cleans up messy data"),
        ("keyring", "handles passwords, logins and access"),
        ("globe", "translates into any language"),
        ("megaphone", "announces updates and posts to social media"),
        ("camera", "snaps photos of receipts, forms or whiteboards"),
        ("paper-plane", "fires off quick replies"),
        ("jigsaw", "fits schedules or pieces together"),
        ("gumball", "hands out one answer or ticket at a time"),
        ("fishing-rod", "fishes the one thing you need out of a pile"),
        ("toaster", "pops out a first draft"),
        ("thermometer", "measures mood, sentiment or satisfaction"),
        ("projector", "turns results into slides and presentations"),
        ("lasso", "rounds up late approvals and stragglers"),
        ("mixer", "blends information from many sources"),
        ("boomerang", "sends follow-ups that always come back"),
        ("dominoes", "kicks off a chain of next steps automatically"),
    ];

    public static readonly HashSet<string> ModuleKinds =
        new(Modules.Select(m => m.Kind), StringComparer.OrdinalIgnoreCase);

    public static string NormalizeCategory(string? category) =>
        Categories.FirstOrDefault(c => string.Equals(c, category?.Trim(), StringComparison.OrdinalIgnoreCase))
        ?? FallbackCategory;
}
