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
        ("bell", "jingle bell that alerts a human"),
        ("antenna", "candy-cane antenna that sends messages"),
        ("printer", "prints reports and documents"),
        ("gift-wrapper", "wraps and delivers the finished result"),
        ("chimney", "vents the busywork away"),
        ("rocket", "booster for extra speed"),
    ];

    public static readonly HashSet<string> ModuleKinds =
        new(Modules.Select(m => m.Kind), StringComparer.OrdinalIgnoreCase);

    public static string NormalizeCategory(string? category) =>
        Categories.FirstOrDefault(c => string.Equals(c, category?.Trim(), StringComparison.OrdinalIgnoreCase))
        ?? FallbackCategory;
}
