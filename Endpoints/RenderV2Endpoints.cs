using System.Text.Json;
using CardConjurer.Models.CardImage;
using CardConjurer.Services.CardImage;

namespace CardConjurer.Endpoints;

public static class RenderV2Endpoints
{
    public static IEndpointRouteBuilder MapRenderV2Endpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/render-v2");

        group.MapPost("/preview", async (
            RenderV2Request request,
            ICardRenderV2Service renderService,
            CancellationToken cancellationToken) =>
        {
            if (request.CardJson.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            {
                return Results.BadRequest(new { error = "Missing cardJson payload." });
            }
            
            var cardData = CardData.FromJsonElement(request.CardJson);
            if (cardData is null)
            {
                return Results.BadRequest(new { error = "Invalid cardJson payload." });
            }

            var stream = await renderService.RenderAsync(cardData, preview: true, request.MaxDimension, cancellationToken);
            return Results.Stream(stream, "image/png");
        });

        group.MapPost("/full", async (
            RenderV2Request request,
            ICardRenderV2Service renderService,
            CancellationToken cancellationToken) =>
        {
            if (request.CardJson.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
            {
                return Results.BadRequest(new { error = "Missing cardJson payload." });
            }

            var cardData = CardData.FromJsonElement(request.CardJson);
            if (cardData is null)
            {
                return Results.BadRequest(new { error = "Invalid cardJson payload." });
            }

            var stream = await renderService.RenderAsync(cardData, preview: false, request.MaxDimension, cancellationToken);
            return Results.Stream(stream, "image/png", fileDownloadName: "renderer-v2.png");
        });

        return app;
    }
}

