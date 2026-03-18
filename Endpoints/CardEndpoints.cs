using System.Text.Json;
using CardConjurer.Models.Cards;
using CardConjurer.Services.Cards;

namespace CardConjurer.Endpoints;

public static class CardEndpoints
{
    public static IEndpointRouteBuilder MapCardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/cards");

        group.MapGet(string.Empty, async (ICardStorageService storage, CancellationToken cancellationToken) =>
        {
            return Results.Ok(await storage.ListAsync(cancellationToken));
        });

        group.MapGet("/{id}", async (string id, ICardStorageService storage, CancellationToken cancellationToken) =>
        {
            var savedCard = await storage.GetAsync(id, cancellationToken);
            return savedCard is null ? Results.NotFound(new { error = "Saved card not found." }) : Results.Ok(savedCard);
        });

        group.MapPost(string.Empty, async (SaveServerCardRequest request, ICardStorageService storage, CancellationToken cancellationToken) =>
        {
            if (request.CardJson.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            {
                return Results.BadRequest(new { error = "Missing cardJson payload." });
            }

            var saved = await storage.SaveAsync(request, cancellationToken);
            return Results.Ok(saved);
        });

        group.MapPost("/import-local", async (ImportServerCardsRequest request, ICardStorageService storage, CancellationToken cancellationToken) =>
        {
            var imported = await storage.ImportLegacyAsync(request.Cards, cancellationToken);
            return Results.Ok(new
            {
                importedCount = imported.Count,
                cards = imported
            });
        });

        group.MapDelete("/{id}", async (string id, ICardStorageService storage, CancellationToken cancellationToken) =>
        {
            var deleted = await storage.DeleteAsync(id, cancellationToken);
            return deleted ? Results.Ok(new { deleted = true }) : Results.NotFound(new { error = "Saved card not found." });
        });

        return app;
    }
}


