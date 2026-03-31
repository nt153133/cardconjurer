using System.Text.Json;
using System.Text.Json.Serialization;

namespace CardConjurer.Models.ImportNormalization;

public sealed record ScryfallCardFaceDto
{
    [JsonPropertyName("object")]
    public string? ObjectType { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("printed_name")]
    public string? PrintedName { get; init; }

    [JsonPropertyName("type_line")]
    public string? TypeLine { get; init; }

    [JsonPropertyName("printed_type_line")]
    public string? PrintedTypeLine { get; init; }

    [JsonPropertyName("oracle_text")]
    public string? OracleText { get; init; }

    [JsonPropertyName("printed_text")]
    public string? PrintedText { get; init; }

    [JsonPropertyName("mana_cost")]
    public string? ManaCost { get; init; }

    [JsonPropertyName("power")]
    public string? Power { get; init; }

    [JsonPropertyName("toughness")]
    public string? Toughness { get; init; }

    [JsonPropertyName("defense")]
    public string? Defense { get; init; }

    [JsonPropertyName("flavor_text")]
    public string? FlavorText { get; init; }

    [JsonPropertyName("image_uris")]
    public Dictionary<string, string>? ImageUris { get; init; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? AdditionalData { get; init; }
}

public sealed record ScryfallCardDto
{
    [JsonPropertyName("object")]
    public string? ObjectType { get; init; }

    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("printed_name")]
    public string? PrintedName { get; init; }

    [JsonPropertyName("flavor_name")]
    public string? FlavorName { get; init; }

    [JsonPropertyName("type_line")]
    public string? TypeLine { get; init; }

    [JsonPropertyName("printed_type_line")]
    public string? PrintedTypeLine { get; init; }

    [JsonPropertyName("oracle_text")]
    public string? OracleText { get; init; }

    [JsonPropertyName("printed_text")]
    public string? PrintedText { get; init; }

    [JsonPropertyName("mana_cost")]
    public string? ManaCost { get; init; }

    [JsonPropertyName("power")]
    public string? Power { get; init; }

    [JsonPropertyName("toughness")]
    public string? Toughness { get; init; }

    [JsonPropertyName("defense")]
    public string? Defense { get; init; }

    [JsonPropertyName("flavor_text")]
    public string? FlavorText { get; init; }

    [JsonPropertyName("layout")]
    public string? Layout { get; init; }

    [JsonPropertyName("set")]
    public string? Set { get; init; }

    [JsonPropertyName("rarity")]
    public string? Rarity { get; init; }

    [JsonPropertyName("collector_number")]
    public string? CollectorNumber { get; init; }

    [JsonPropertyName("lang")]
    public string? Lang { get; init; }

    [JsonPropertyName("artist")]
    public string? Artist { get; init; }

    [JsonPropertyName("hand_modifier")]
    public string? HandModifier { get; init; }

    [JsonPropertyName("life_modifier")]
    public string? LifeModifier { get; init; }

    [JsonPropertyName("image_uris")]
    public Dictionary<string, string>? ImageUris { get; init; }

    [JsonPropertyName("card_faces")]
    public List<ScryfallCardFaceDto>? CardFaces { get; init; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? AdditionalData { get; init; }
}

public sealed record ParsedCardFromTextResult
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("lang")]
    public string Lang { get; init; } = "en";

    [JsonPropertyName("mana_cost")]
    public string? ManaCost { get; init; }

    [JsonPropertyName("type_line")]
    public string? TypeLine { get; init; }

    [JsonPropertyName("power")]
    public string? Power { get; init; }

    [JsonPropertyName("toughness")]
    public string? Toughness { get; init; }

    [JsonPropertyName("oracle_text")]
    public string? OracleText { get; init; }
}

public sealed record SagaAbilityDto(string Ability, int Steps);

public sealed record ClassAbilityDto(string Cost, string Ability);

public sealed record ParsedFaceData(string Name, string Type, string Rules, string Mana, string Pt, string Defense, string Flavor);

public sealed record MultiFacedParseResult(ParsedFaceData Front, ParsedFaceData Back);

public sealed record LevelerLevelDto(string Range, string Pt, List<string> Abilities, string RulesText);

public sealed record LevelerParseResult(
    string Layout,
    string Name,
    string Type,
    string Mana,
    string BasePt,
    string LevelUpCost,
    string LevelUpText,
    List<LevelerLevelDto> Levels);

public sealed record PrototypeData(string Cost, string Pt, string ReminderText);

public sealed record PrototypeParseResult(
    string Layout,
    string Name,
    string Type,
    string Mana,
    string BasePt,
    string Rules,
    PrototypeData Prototype);

public sealed record MutateData(string Cost, string ReminderText);

public sealed record MutateParseResult(
    string Layout,
    string Name,
    string Type,
    string Mana,
    string BasePt,
    string Rules,
    MutateData Mutate);

public sealed record VanguardParseResult(
    string Layout,
    string Name,
    string Type,
    string Rules,
    string Flavor,
    string HandModifier,
    string LifeModifier);

public sealed record StationAbilityDto(string Number, string Text);

public sealed record StationParseResult(string PreStationText, List<StationAbilityDto> StationAbilities);

public sealed record LocalStorageCardUploadPreparationRequest(string ClientCardKey, JsonElement CardJson, ScryfallCardDto? ImportedCard = null);

public sealed record LocalStorageCardUploadPreparationResult(
    string SchemaVersion,
    DateTimeOffset ReceivedAtUtc,
    string ClientCardKey,
    JsonElement RawCardJson,
    ScryfallCardDto? ImportedCard,
    List<ScryfallCardDto> NormalizedImportedCards);