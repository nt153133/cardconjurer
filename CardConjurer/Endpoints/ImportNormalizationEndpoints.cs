using CardConjurer.Models.ImportNormalization;
using CardConjurer.Services.ImportNormalization;

namespace CardConjurer.Endpoints;

public static class ImportNormalizationEndpoints
{
    public static IEndpointRouteBuilder MapImportNormalizationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/import-normalization");

        group.MapPost("/from-text", (ParseTextRequest request, ICardImportNormalizationService service) =>
        {
            return Results.Ok(service.ParseCardFromText(request.Text));
        });

        group.MapPost("/saga", (ParseTextRequest request, ICardImportNormalizationService service) =>
        {
            return Results.Ok(new
            {
                abilities = service.ParseSagaAbilities(request.Text),
                reminderText = service.ExtractSagaReminderText(request.Text)
            });
        });

        group.MapPost("/class", (ParseTextRequest request, ICardImportNormalizationService service) =>
        {
            return Results.Ok(service.ParseClassAbilities(request.Text));
        });

        group.MapPost("/roll", (ParseTextRequest request, ICardImportNormalizationService service) =>
        {
            return Results.Ok(new { text = service.ParseRollAbilities(request.Text) });
        });

        group.MapPost("/station", (ParseTextRequest request, ICardImportNormalizationService service) =>
        {
            var result = service.ParseStationCard(request.Text);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        group.MapPost("/process-scryfall-card", (ScryfallCardDto card, ICardImportNormalizationService service) =>
        {
            return Results.Ok(service.ProcessScryfallCard(card));
        });

        group.MapPost("/process-scryfall-cards", (List<ScryfallCardDto> cards, ICardImportNormalizationService service) =>
        {
            var result = cards.SelectMany(card => service.ProcessScryfallCard(card)).ToList();
            return Results.Ok(result);
        });

        group.MapPost("/multi-faced", (MultiFaceParseRequest request, ICardImportNormalizationService service) =>
        {
            var result = service.ParseMultiFacedCards(request.Card, request.ContextCards);
            return result is null ? Results.BadRequest("Could not determine front/back faces.") : Results.Ok(result);
        });

        group.MapPost("/layout-specific", (ScryfallCardDto card, ICardImportNormalizationService service) =>
        {
            var result = new
            {
                leveler = service.ParseLevelerCard(card),
                prototype = service.ParsePrototypeLayout(card),
                mutate = service.ParseMutateLayout(card),
                vanguard = service.ParseVanguardLayout(card)
            };
            return Results.Ok(result);
        });

        var cardsGroup = app.MapGroup("/api/cards");
        cardsGroup.MapPost("/prepare-localstorage-upload", (LocalStorageCardUploadPreparationRequest request, ICardImportNormalizationService service) =>
        {
            var normalizedImported = request.ImportedCard is null
                ? new List<ScryfallCardDto>()
                : service.ProcessScryfallCard(request.ImportedCard);

            var response = new LocalStorageCardUploadPreparationResult(
                SchemaVersion: "v1",
                ReceivedAtUtc: DateTimeOffset.UtcNow,
                ClientCardKey: request.ClientCardKey,
                RawCardJson: request.CardJson,
                ImportedCard: request.ImportedCard,
                NormalizedImportedCards: normalizedImported);

            return Results.Ok(response);
        });

        return app;
    }

    public sealed record ParseTextRequest(string Text);

    public sealed record MultiFaceParseRequest(ScryfallCardDto Card, List<ScryfallCardDto>? ContextCards);
}
