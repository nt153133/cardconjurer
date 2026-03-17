using CardConjurer.Models.ImportNormalization;

namespace CardConjurer.Services.ImportNormalization;

public interface ICardImportNormalizationService
{
    ParsedCardFromTextResult ParseCardFromText(string text);
    List<SagaAbilityDto> ParseSagaAbilities(string text);
    string? ExtractSagaReminderText(string text);
    List<ClassAbilityDto> ParseClassAbilities(string text);
    string? ParseRollAbilities(string text);
    StationParseResult? ParseStationCard(string oracleText);
    MultiFacedParseResult? ParseMultiFacedCards(ScryfallCardDto card, IReadOnlyList<ScryfallCardDto>? contextCards = null);
    LevelerParseResult? ParseLevelerCard(ScryfallCardDto card);
    PrototypeParseResult? ParsePrototypeLayout(ScryfallCardDto card);
    MutateParseResult? ParseMutateLayout(ScryfallCardDto card);
    VanguardParseResult? ParseVanguardLayout(ScryfallCardDto card);
    List<ScryfallCardDto> ProcessScryfallCard(ScryfallCardDto card);
}
