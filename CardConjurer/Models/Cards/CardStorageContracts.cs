using System.Text.Json;

namespace CardConjurer.Models.Cards;

public sealed record SavedCardSummary(
    string Id,
    string DisplayName,
    string? LegacyKey,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record SavedCardDetails(
    string Id,
    string DisplayName,
    string? LegacyKey,
    JsonElement CardJson,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record SaveServerCardRequest(
    string? Id,
    string? DisplayName,
    JsonElement CardJson,
    string? LegacyKey = null);

public sealed record LegacySavedCardFileItem(
    string Key,
    JsonElement Data,
    string? Id = null,
    string? Name = null);

public sealed record ImportServerCardsRequest(List<LegacySavedCardFileItem> Cards);

