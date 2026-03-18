using System.Text.Json;
using System.Text.RegularExpressions;
using CardConjurer.Models.Cards;
using Microsoft.Extensions.Options;

namespace CardConjurer.Services.Cards;

public sealed class FileSystemCardStorageService : ICardStorageService
{
    private static readonly Regex SafeIdPattern = new("^[A-Za-z0-9_-]{8,128}$", RegexOptions.Compiled);
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly string _cardsRoot;
    private readonly SemaphoreSlim _mutex = new(1, 1);

    public FileSystemCardStorageService(IOptions<CardStorageOptions> options, IWebHostEnvironment environment)
    {
        _cardsRoot = ResolveCardsRoot(options.Value.Root, environment.ContentRootPath);
        Directory.CreateDirectory(_cardsRoot);
    }

    public async Task<IReadOnlyList<SavedCardSummary>> ListAsync(CancellationToken cancellationToken = default)
    {
        var items = new List<SavedCardSummary>();
        foreach (var filePath in Directory.EnumerateFiles(_cardsRoot, "*.json", SearchOption.TopDirectoryOnly))
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var document = await ReadDocumentAsync(filePath, cancellationToken);
                if (document is null)
                {
                    continue;
                }

                items.Add(ToSummary(document));
            }
            catch
            {
                // Ignore malformed single-card files and continue listing other cards.
            }
        }

        return items
            .OrderBy(item => item.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ThenByDescending(item => item.UpdatedAtUtc)
            .ToArray();
    }

    public async Task<SavedCardDetails?> GetAsync(string id, CancellationToken cancellationToken = default)
    {
        var filePath = TryResolveCardPath(id);
        if (filePath is null || !File.Exists(filePath))
        {
            return null;
        }

        var document = await ReadDocumentAsync(filePath, cancellationToken);
        return document is null ? null : ToDetails(document);
    }

    public async Task<SavedCardDetails> SaveAsync(SaveServerCardRequest request, CancellationToken cancellationToken = default)
    {
        var cardJson = CloneJson(request.CardJson);
        await _mutex.WaitAsync(cancellationToken);
        try
        {
            var existing = await FindExistingDocumentAsync(request.Id, request.LegacyKey, cancellationToken);
            var id = existing?.Id ?? NormalizeOrCreateId(request.Id);
            var now = DateTimeOffset.UtcNow;
            var displayName = ResolveDisplayName(request.DisplayName, request.LegacyKey, cardJson);
            var document = new StoredCardDocument(
                Id: id,
                DisplayName: displayName,
                LegacyKey: string.IsNullOrWhiteSpace(request.LegacyKey) ? existing?.LegacyKey : request.LegacyKey!.Trim(),
                CardJson: cardJson,
                CreatedAtUtc: existing?.CreatedAtUtc ?? now,
                UpdatedAtUtc: now);

            await WriteDocumentAsync(document, cancellationToken);
            return ToDetails(document);
        }
        finally
        {
            _mutex.Release();
        }
    }

    public async Task<IReadOnlyList<SavedCardSummary>> ImportLegacyAsync(IEnumerable<LegacySavedCardFileItem> cards, CancellationToken cancellationToken = default)
    {
        var imported = new List<SavedCardSummary>();
        foreach (var item in cards)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var saved = await SaveAsync(new SaveServerCardRequest(
                Id: item.Id,
                DisplayName: item.Name ?? item.Key,
                CardJson: item.Data,
                LegacyKey: item.Key), cancellationToken);

            imported.Add(new SavedCardSummary(saved.Id, saved.DisplayName, saved.LegacyKey, saved.CreatedAtUtc, saved.UpdatedAtUtc));
        }

        return imported;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default)
    {
        var filePath = TryResolveCardPath(id);
        if (filePath is null || !File.Exists(filePath))
        {
            return false;
        }

        await _mutex.WaitAsync(cancellationToken);
        try
        {
            if (!File.Exists(filePath))
            {
                return false;
            }

            await Task.Run(() => File.Delete(filePath), cancellationToken);
            return true;
        }
        finally
        {
            _mutex.Release();
        }
    }

    public static string ResolveCardsRoot(string configuredPath, string contentRootPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            configuredPath = "data/cards";
        }

        return Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.GetFullPath(Path.Combine(contentRootPath, configuredPath));
    }

    private async Task<StoredCardDocument?> FindExistingDocumentAsync(string? requestedId, string? legacyKey, CancellationToken cancellationToken)
    {
        var existingByIdPath = TryResolveCardPath(requestedId);
        if (existingByIdPath is not null && File.Exists(existingByIdPath))
        {
            return await ReadDocumentAsync(existingByIdPath, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(legacyKey))
        {
            return null;
        }

        foreach (var filePath in Directory.EnumerateFiles(_cardsRoot, "*.json", SearchOption.TopDirectoryOnly))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var document = await ReadDocumentAsync(filePath, cancellationToken);
            if (document is not null && string.Equals(document.LegacyKey, legacyKey.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return document;
            }
        }

        return null;
    }

    private async Task<StoredCardDocument?> ReadDocumentAsync(string filePath, CancellationToken cancellationToken)
    {
        await using var stream = File.OpenRead(filePath);
        return await JsonSerializer.DeserializeAsync<StoredCardDocument>(stream, SerializerOptions, cancellationToken);
    }

    private async Task WriteDocumentAsync(StoredCardDocument document, CancellationToken cancellationToken)
    {
        var filePath = Path.Combine(_cardsRoot, document.Id + ".json");
        await using var stream = File.Create(filePath);
        await JsonSerializer.SerializeAsync(stream, document, SerializerOptions, cancellationToken);
    }

    private string? TryResolveCardPath(string? id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return null;
        }

        var normalizedId = id.Trim();
        if (!SafeIdPattern.IsMatch(normalizedId))
        {
            return null;
        }

        var fullPath = Path.GetFullPath(Path.Combine(_cardsRoot, normalizedId + ".json"));
        return fullPath.StartsWith(_cardsRoot, StringComparison.OrdinalIgnoreCase) ? fullPath : null;
    }

    private static string NormalizeOrCreateId(string? id)
    {
        if (!string.IsNullOrWhiteSpace(id) && SafeIdPattern.IsMatch(id.Trim()))
        {
            return id.Trim();
        }

        return Guid.NewGuid().ToString("N");
    }

    private static string ResolveDisplayName(string? displayName, string? legacyKey, JsonElement cardJson)
    {
        var candidate = displayName;
        if (string.IsNullOrWhiteSpace(candidate))
        {
            candidate = legacyKey;
        }

        if (string.IsNullOrWhiteSpace(candidate)
            && cardJson.ValueKind == JsonValueKind.Object
            && cardJson.TryGetProperty("text", out var text)
            && text.ValueKind == JsonValueKind.Object
            && text.TryGetProperty("title", out var title)
            && title.ValueKind == JsonValueKind.Object
            && title.TryGetProperty("text", out var titleText)
            && titleText.ValueKind == JsonValueKind.String)
        {
            candidate = titleText.GetString();
        }

        candidate = string.IsNullOrWhiteSpace(candidate) ? "unnamed" : candidate.Trim();
        return candidate.Length > 200 ? candidate[..200].Trim() : candidate;
    }

    private static JsonElement CloneJson(JsonElement json)
    {
        using var document = JsonDocument.Parse(json.GetRawText());
        return document.RootElement.Clone();
    }

    private static SavedCardSummary ToSummary(StoredCardDocument document)
    {
        return new SavedCardSummary(document.Id, document.DisplayName, document.LegacyKey, document.CreatedAtUtc, document.UpdatedAtUtc);
    }

    private static SavedCardDetails ToDetails(StoredCardDocument document)
    {
        return new SavedCardDetails(document.Id, document.DisplayName, document.LegacyKey, document.CardJson, document.CreatedAtUtc, document.UpdatedAtUtc);
    }

    private sealed record StoredCardDocument(
        string Id,
        string DisplayName,
        string? LegacyKey,
        JsonElement CardJson,
        DateTimeOffset CreatedAtUtc,
        DateTimeOffset UpdatedAtUtc);
}

