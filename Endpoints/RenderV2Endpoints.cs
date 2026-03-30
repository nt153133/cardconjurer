using System.Text.Json;
using CardConjurer.Models.CardImage;
using CardConjurer.Services.CardImage;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

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

            var stream = await renderService.RenderAsync(
                cardData,
                preview: true,
                request.MaxDimension,
                request.CardSizeProfileName,
                request.IsPrintImage,
                cancellationToken);
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

            if (request.IsPrintImage)
            {
                var layered = await renderService.RenderLayeredAsync(
                    cardData,
                    preview: false,
                    request.MaxDimension,
                    request.CardSizeProfileName,
                    request.IsPrintImage,
                    cancellationToken);

                using (layered.ArtLayerStream)
                using (layered.TextLayerStream)
                {
                    var composited = await CompositeLayersAsync(layered.ArtLayerStream, layered.TextLayerStream, cancellationToken);
                    return Results.Stream(composited, "image/png", fileDownloadName: "renderer-v2.png");
                }
            }

            var stream = await renderService.RenderAsync(
                cardData,
                preview: false,
                request.MaxDimension,
                request.CardSizeProfileName,
                request.IsPrintImage,
                cancellationToken);
            
            /*
            using MemoryStream memoryStream = new();
            await stream.CopyToAsync(memoryStream, cancellationToken);
            memoryStream.Position = 0;
            stream.Position = 0;
            
            // 2. Load the stream into Magick.NET
            using var magickImage = new MagickImage(memoryStream, MagickFormat.Png32);
            var cmykProfile = ColorProfiles.USWebCoatedSWOP; // A common CMYK profile for print. Adjust as needed for your specific printer and paper.
            
            Log.Information("Original image color space: {ColorSpace}", magickImage.ColorSpace);
            
            // 5. Apply the new profile
            // In Magick.NET, adding a second color profile automatically triggers 
            // the mathematical conversion from the first profile to the second.
            magickImage.SetProfile(cmykProfile);
            var result = magickImage.TransformColorSpace(cmykProfile);
            Log.Information("Result: {Result}", result);
            
            magickImage.AutoLevel();
            Log.Information("Transformed image color space: {ColorSpace}", magickImage.ColorSpace);
            // 6. Set output settings for high-quality print
            magickImage.Format = MagickFormat.Tiff; // PDF/A is a good choice for print-ready files, but you can also use TIFF or high-quality PNG depending on your needs
            magickImage.ColorSpace = cmykProfile.ColorSpace;
            Log.Information("Final image color space: {ColorSpace}", magickImage.GetColorProfile()?.Name);
    
            // LZW is lossless compression. It keeps the file size down without 
            // introducing JPEG-style artifacts around your text and mana symbols.
           // magickImage.Settings.Compression = CompressionMethod.; 
    
            // Set density to 300 or 600 DPI depending on your target resolution
            magickImage.Density = new Density(800, 800, DensityUnit.PixelsPerInch);
            
            //save pdf
            magickImage.Write("renderer-v2.tiff");
            */
                
            
            return Results.Stream(stream, "image/png", fileDownloadName: "renderer-v2.png");
        });

        return app;
    }

    private static async Task<Stream> CompositeLayersAsync(
        Stream artLayerStream,
        Stream textLayerStream,
        CancellationToken cancellationToken)
    {
        artLayerStream.Seek(0, SeekOrigin.Begin);
        textLayerStream.Seek(0, SeekOrigin.Begin);

        using var artImage = await Image.LoadAsync<Rgba32>(artLayerStream, cancellationToken);
        using var textImage = await Image.LoadAsync<Rgba32>(textLayerStream, cancellationToken);

        if (artImage.Width != textImage.Width || artImage.Height != textImage.Height)
        {
            throw new InvalidOperationException("Layered render output size mismatch.");
        }

        artImage.Mutate(ctx => ctx.DrawImage(textImage, new Point(0, 0), 1f));

        var output = new MemoryStream();
        await artImage.SaveAsPngAsync(output, cancellationToken);
        output.Seek(0, SeekOrigin.Begin);
        return output;
    }
}

