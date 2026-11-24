using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Extensions.Options;
using SantasWorkshop.Models;

namespace SantasWorkshop.Services;

/// <summary>
/// In-memory store of wishes and leads, persisted to two JSON files after every change.
/// A booth night is a few hundred records, so a lock and a file rewrite are plenty.
/// </summary>
public sealed class WishStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    private readonly Lock _gate = new();
    private readonly List<Wish> _wishes;
    private readonly List<Lead> _leads;
    private readonly string _wishPath;
    private readonly string _leadPath;
    private readonly WorkshopOptions _options;

    public WishStore(IOptions<WorkshopOptions> options, IWebHostEnvironment env, ILogger<WishStore> logger)
    {
        _options = options.Value;
        var dir = Path.IsPathRooted(_options.DataDirectory)
            ? _options.DataDirectory
            : Path.Combine(env.ContentRootPath, _options.DataDirectory);
        Directory.CreateDirectory(dir);
        _wishPath = Path.Combine(dir, "wishes.json");
        _leadPath = Path.Combine(dir, "leads.json");
        _wishes = Load<Wish>(_wishPath);
        _leads = Load<Lead>(_leadPath);
        logger.LogInformation("Loaded {Wishes} wishes and {Leads} leads from {Dir}", _wishes.Count, _leads.Count, dir);
    }

    public Wish AddWish(Wish wish)
    {
        lock (_gate)
        {
            wish.Id = NewId();
            wish.Number = _wishes.Count == 0 ? 1 : _wishes.Max(w => w.Number) + 1;
            _wishes.Add(wish);
            Save(_wishPath, _wishes);
            return wish;
        }
    }

    public Wish? GetWish(string id)
    {
        lock (_gate) return _wishes.FirstOrDefault(w => w.Id == id);
    }

    public List<Wish> AllWishes()
    {
        lock (_gate) return _wishes.OrderByDescending(w => w.Number).ToList();
    }

    public Wish? SetHidden(string id, bool hidden)
    {
        lock (_gate)
        {
            var wish = _wishes.FirstOrDefault(w => w.Id == id);
            if (wish is null) return null;
            wish.Hidden = hidden;
            Save(_wishPath, _wishes);
            return wish;
        }
    }

    public Lead AddLead(Lead lead)
    {
        lock (_gate)
        {
            lead.Id = NewId();
            _leads.Add(lead);
            Save(_leadPath, _leads);
            return lead;
        }
    }

    public Lead? GetLead(string id)
    {
        lock (_gate) return _leads.FirstOrDefault(l => l.Id == id);
    }

    public bool HasLeadForWish(string wishId)
    {
        lock (_gate) return _leads.Any(l => l.WishId == wishId);
    }

    public List<Lead> AllLeads()
    {
        lock (_gate) return _leads.OrderByDescending(l => l.CreatedAt).ToList();
    }

    public Lead? UpdateLead(string id, Action<Lead> change)
    {
        lock (_gate)
        {
            var lead = _leads.FirstOrDefault(l => l.Id == id);
            if (lead is null) return null;
            change(lead);
            Save(_leadPath, _leads);
            return lead;
        }
    }

    public WorkshopStats GetStats()
    {
        lock (_gate)
        {
            var onWall = _wishes.Where(w => w.IsOnWall).ToList();
            var categories = onWall
                .GroupBy(w => w.Category)
                .Select(g => new CategoryStat(g.Key, g.Sum(w => w.Practical.HoursSavedPerYear), g.Count()))
                .OrderByDescending(c => c.Hours)
                .ToList();
            return new WorkshopStats(
                TotalHours: _options.StartingHours + onWall.Sum(w => w.Practical.HoursSavedPerYear),
                WishCount: onWall.Count,
                LeadCount: _leads.Count,
                Categories: categories);
        }
    }

    private static List<T> Load<T>(string path)
    {
        if (!File.Exists(path)) return [];
        var json = File.ReadAllText(path);
        return string.IsNullOrWhiteSpace(json) ? [] : JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
    }

    private static void Save<T>(string path, List<T> items)
    {
        // Write to a temp file and swap it in so a crash mid-write can't truncate the data.
        var temp = path + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(items, JsonOptions));
        File.Move(temp, path, overwrite: true);
    }

    /// <summary>Short, unguessable id (used in card URLs), Crockford base32 without look-alikes.</summary>
    private static string NewId()
    {
        const string alphabet = "23456789abcdefghjkmnpqrstvwxyz";
        Span<byte> bytes = stackalloc byte[10];
        RandomNumberGenerator.Fill(bytes);
        var chars = new char[10];
        for (var i = 0; i < chars.Length; i++) chars[i] = alphabet[bytes[i] % alphabet.Length];
        return new string(chars);
    }
}

public sealed record CategoryStat(string Name, int Hours, int Count);

public sealed record WorkshopStats(int TotalHours, int WishCount, int LeadCount, List<CategoryStat> Categories);
