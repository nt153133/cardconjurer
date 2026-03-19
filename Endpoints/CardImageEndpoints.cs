using System.Text.Json;
using CardConjurer.Models.CardImage;
using CardConjurer.Models.CardImage.Sizing;
using CardConjurer.Services.CardImage;

namespace CardConjurer.Endpoints;

public static class CardImageEndpoints
{
    public static IEndpointRouteBuilder MapCardImageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/card-image");

        /// <summary>
        /// GET /api/card-image/size-profiles
        /// Returns predefined size profiles for UI selection.
        /// </summary>
        group.MapGet("/size-profiles", () =>
        {
            var profiles = CardSizeCatalog.Profiles
                .Select(p => new
                {
                    p.Name,
                    p.Dpi,
                    cut = new { width = p.CutSize.Width, height = p.CutSize.Height },
                    bleed = new { width = p.BleedSize.Width, height = p.BleedSize.Height },
                    safe = new { width = p.SafeSize.Width, height = p.SafeSize.Height },
                    marginScale = new { uniform = 1, x = p.MarginScaleX, y = p.MarginScaleY },
                    // Debug helpers: verify margin scale produces correct bleed size via JS formula: cut * (1 + 2*margin)
                    expectedBleedFromCutX = (int)(p.CutSize.Width * (1 + 2 * p.MarginScaleX)),
                    expectedBleedFromCutY = (int)(p.CutSize.Height * (1 + 2 * p.MarginScaleY)),
                    debug = p.MarginScaleDebugString
                })
                .ToList();

            return Results.Ok(new
            {
                defaultProfileName = CardSizeCatalog.DefaultProfile.Name,
                profiles
            });
        });

        /// <summary>
        /// POST /api/card-image/render
        /// Accepts a base64-encoded PNG from the browser canvas plus the card
        /// JSON object, processes it through ImageSharp (embedding metadata),
        /// and returns the finished image file for download.
        /// </summary>
        group.MapPost("/render", async (
            RenderCardImageRequest request,
            ICardImageService imageService,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.ImageBase64))
            {
                return Results.BadRequest(new { error = "Missing imageBase64." });
            }

            byte[] sourceBytes;
            try
            {
                sourceBytes = Convert.FromBase64String(request.ImageBase64);
            }
            catch (FormatException)
            {
                return Results.BadRequest(new { error = "Invalid base64 image data." });
            }

            var format = string.Equals(request.Format, "jpeg", StringComparison.OrdinalIgnoreCase)
                ? "jpeg"
                : "png";

            // Deserialize into the strongly-typed model for any server-side
            // use (e.g., naming, future server-side card storage, pipeline opts).
            var cardData = request.CardJson.ValueKind is not
                    (JsonValueKind.Undefined or JsonValueKind.Null)
                ? CardData.FromJsonElement(request.CardJson)
                : null;

            // Raw JSON string to embed in the image metadata
            var cardJsonString = request.CardJson.ValueKind is not
                    (JsonValueKind.Undefined or JsonValueKind.Null)
                ? request.CardJson.GetRawText()
                : null;

            // Prefer the card's own title for the filename if the caller
            // didn't supply one, falling back to "card"
            var baseName = !string.IsNullOrWhiteSpace(request.FileName)
                ? request.FileName
                : cardData?.GetTitle() ?? "card";

            var safeName  = SanitizeFileName(baseName);
            var extension = format == "jpeg" ? "jpeg" : "png";
            var fileName  = $"{safeName}.{extension}";
            var mimeType  = format == "jpeg" ? "image/jpeg" : "image/png";

            var outputStream = await imageService.ProcessAsync(
                sourceBytes, format, cardJsonString,request.CardSizeProfileName, request.IsPrintImage, cancellationToken);

            return Results.Stream(
                stream: outputStream,
                contentType: mimeType,
                fileDownloadName: fileName,
                enableRangeProcessing: false);
        });

        return app;
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Concat(name.Select(c => invalid.Contains(c) ? '_' : c));
    }
}

/// <summary>Request body for POST /api/card-image/render</summary>
public sealed record RenderCardImageRequest(
    /// <summary>Base64-encoded PNG bytes from canvas.toDataURL('image/png').split(',')[1]</summary>
    string ImageBase64,
    /// <summary>Full card JSON object (frames stripped of Image objects client-side)</summary>
    JsonElement CardJson,
    /// <summary>Suggested file name without extension</summary>
    string? FileName,
    /// <summary>"png" or "jpeg". Defaults to "png".</summary>
    string? Format,
    /// <summary>Selected card-size profile name from the Creator UI.</summary>
    string? CardSizeProfileName = null,
    /// <summary>True when export target is print/bleed image. Defaults to false (cut image).</summary>
    bool IsPrintImage = false);
