namespace SantasWorkshop;

/// <summary>Booth settings, bound from the "Workshop" configuration section.</summary>
public sealed class WorkshopOptions
{
    public const string Section = "Workshop";

    // Branding and copy shown on the screens.
    public string CompanyName { get; set; } = "IntelliTect";
    public string CompanyUrl { get; set; } = "https://intellitect.com";
    public string? LogoUrl { get; set; }
    public string EventName { get; set; } = "Innovate Inland Northwest Christmas Party";
    public string RegionName { get; set; } = "the Inland Northwest";
    public int BuiltInDays { get; set; } = 2;

    /// <summary>Added to the hours counter, e.g. to carry over a total after a restart on a new machine.</summary>
    public int StartingHours { get; set; }

    /// <summary>
    /// Base URL that guests' phones use when they scan a QR code, e.g. https://santa.example.com.
    /// Leave empty to use the URL the kiosk is browsing.
    /// </summary>
    public string? PublicBaseUrl { get; set; }

    /// <summary>Required for /admin. Admin is disabled while this is empty.</summary>
    public string? AdminKey { get; set; }

    /// <summary>
    /// When set, only a kiosk opened with ?key=... can submit wishes (keeps strangers on the
    /// public URL from spending API credits). Leave empty for open submissions.
    /// </summary>
    public string? KioskKey { get; set; }

    public string DataDirectory { get; set; } = "App_Data";

    // Claude settings.
    public string Model { get; set; } = "claude-opus-5-5";
    public string Effort { get; set; } = "low";
    public bool UseFastMode { get; set; }
    public int ClaudeTimeoutSeconds { get; set; } = 40;

    /// <summary>Skip Claude entirely and use the offline template elf.</summary>
    public bool UseBackupElfOnly { get; set; }

    // Machine pictures (optional): a Microsoft MAI image model deployed in Microsoft Foundry paints each machine.
    // Pictures are off until ImageEndpoint, ImageKey and ImageDeployment are all set.

    /// <summary>
    /// The Foundry resource, e.g. https://my-resource.services.ai.azure.com, or the deployment's full
    /// .../mai/v1/images/generations URL.
    /// </summary>
    public string? ImageEndpoint { get; set; }

    public string? ImageKey { get; set; }

    /// <summary>The deployment name given to the MAI image model in Foundry (sent as "model").</summary>
    public string? ImageDeployment { get; set; }

    /// <summary>One attempt at painting a picture gives up after this long.</summary>
    public int ImageTimeoutSeconds { get; set; } = 90;

    public bool PicturesEnabled =>
        !string.IsNullOrWhiteSpace(ImageEndpoint) && !string.IsNullOrWhiteSpace(ImageKey) &&
        !string.IsNullOrWhiteSpace(ImageDeployment);
}
