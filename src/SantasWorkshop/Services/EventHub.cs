using System.Collections.Concurrent;
using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Threading.Channels;

namespace SantasWorkshop.Services;

/// <summary>Fans out live events (new wishes, refreshes) to every open TV screen over server-sent events.</summary>
public sealed class EventHub : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly ConcurrentDictionary<Guid, Channel<SseItem<string>>> _subscribers = new();
    private readonly Timer _keepAlive;

    public EventHub()
    {
        // Proxies and some TV browsers drop quiet connections; a ping every 20s keeps them open.
        _keepAlive = new Timer(_ => Publish("ping", new { }), null, TimeSpan.FromSeconds(20), TimeSpan.FromSeconds(20));
    }

    public int SubscriberCount => _subscribers.Count;

    public void Publish(string eventType, object payload)
    {
        var item = new SseItem<string>(JsonSerializer.Serialize(payload, JsonOptions), eventType);
        foreach (var channel in _subscribers.Values) channel.Writer.TryWrite(item);
    }

    public async IAsyncEnumerable<SseItem<string>> Subscribe([EnumeratorCancellation] CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<SseItem<string>>(new BoundedChannelOptions(100)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
        });
        _subscribers[id] = channel;
        try
        {
            yield return new SseItem<string>("{}", "hello");
            await foreach (var item in channel.Reader.ReadAllAsync(ct)) yield return item;
        }
        finally
        {
            _subscribers.TryRemove(id, out _);
        }
    }

    public void Dispose() => _keepAlive.Dispose();
}
