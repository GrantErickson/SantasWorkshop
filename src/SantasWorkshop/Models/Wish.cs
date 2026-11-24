namespace SantasWorkshop.Models;

/// <summary>One wish made at the kiosk, plus everything the elf produced for it.</summary>
public sealed class Wish
{
    public string Id { get; set; } = "";
    public int Number { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Exactly what the guest typed or said. Never shown on the public wall.</summary>
    public string Text { get; set; } = "";

    /// <summary>Anonymized phrase that completes "I wish AI would …". This is what the wall shows.</summary>
    public string WallText { get; set; } = "";

    public string Category { get; set; } = Catalog.FallbackCategory;

    /// <summary>False when the elf judged the wish unfit for a public screen.</summary>
    public bool Appropriate { get; set; } = true;

    /// <summary>Hidden by staff from the admin page.</summary>
    public bool Hidden { get; set; }

    /// <summary>"claude" or "backup" (the offline template elf).</summary>
    public string Source { get; set; } = "claude";

    public double ElapsedSeconds { get; set; }

    public Blueprint Blueprint { get; set; } = new();
    public PracticalPlan Practical { get; set; } = new();

    /// <summary>The AI-painted picture of the machine: "" (none), pending, ready, failed or removed.</summary>
    public string PictureStatus { get; set; } = "";

    /// <summary>Goes up each time the picture is repainted, so browsers fetch the new one.</summary>
    public int PictureVersion { get; set; }

    public double PictureSeconds { get; set; }

    public bool IsOnWall => Appropriate && !Hidden;

    public bool PicturePending => PictureStatus == PictureStatuses.Pending;

    /// <summary>Where browsers load the picture from, or null while there isn't one to show.</summary>
    public string? PictureUrl => PictureStatus == PictureStatuses.Ready ? $"/api/wishes/{Id}/picture?v={PictureVersion}" : null;
}

public static class PictureStatuses
{
    public const string Pending = "pending";
    public const string Ready = "ready";
    public const string Failed = "failed";
    public const string Removed = "removed";
}

/// <summary>The silly half: a "toy blueprint" for an elf machine that does the job.</summary>
public sealed class Blueprint
{
    public string MachineName { get; set; } = "";
    public string Tagline { get; set; } = "";
    public List<BlueprintModule> Modules { get; set; } = [];
    public string Fineprint { get; set; } = "";
}

public sealed class BlueprintModule
{
    public string Kind { get; set; } = "";
    public string Label { get; set; } = "";
}

/// <summary>The real half: how AI could actually handle the task.</summary>
public sealed class PracticalPlan
{
    public string Headline { get; set; } = "";
    public List<string> Steps { get; set; } = [];
    public List<string> Techniques { get; set; } = [];
    public string FirstStep { get; set; } = "";
    public int HoursSavedPerYear { get; set; }
    public string HoursAssumption { get; set; } = "";
}

/// <summary>Shape of the elf's structured JSON answer.</summary>
public sealed class ElfAnswer
{
    public bool Appropriate { get; set; } = true;
    public string WallText { get; set; } = "";
    public string Category { get; set; } = "";
    public Blueprint Blueprint { get; set; } = new();
    public PracticalPlan Practical { get; set; } = new();
}
