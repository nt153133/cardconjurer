using LlamaMagic.Rendering.Models;
using ImageMagick;
using LlamaMagic.Rendering.Sizing;
using Serilog;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace LlamaMagic.Rendering;

public sealed class PrepressService : IPrepressService
{
    public async Task<Stream> ProcessPrintPipelineAsync(
        Stream artLayerStream,
        Stream textLayerStream,
        PrepressPipelineOptions options,
        CancellationToken cancellationToken = default)
    {
        var context = await Stage1IngestionAndValidationAsync(artLayerStream, textLayerStream, options, cancellationToken);

        // Stage 2 (mock): apply RGB-space global adjustments before any CMYK conversion.
        await Stage2GlobalColorAdjustmentsAsync(context, cancellationToken);

        // Stage 3 (mock): isolate pure-black elements and convert remaining artwork to target CMYK profile.
        await Stage3SeparationAndIccConversionAsync(context, cancellationToken);

        // Stage 4 (mock): force text/outline black into K-only and overprint/trap onto converted artwork.
        await Stage4100KTrappingAndOverprintAsync(context, cancellationToken);

        // Stage 5 (current behavior): flatten and export as a single composited PNG stream.
        return await Stage5FinalizeAndExportAsync(context, cancellationToken);
    }

    private static async Task<PrepressPipelineContext> Stage1IngestionAndValidationAsync(
        Stream artLayerStream,
        Stream textLayerStream,
        PrepressPipelineOptions options,
        CancellationToken cancellationToken)
    {
        artLayerStream.Seek(0, SeekOrigin.Begin);
        textLayerStream.Seek(0, SeekOrigin.Begin);

        var artLayer = await Image.LoadAsync<Rgba32>(artLayerStream, cancellationToken);

        var textLayer = await Image.LoadAsync<Rgba32>(textLayerStream, cancellationToken);
        textLayer.Mutate(ctx => ctx.BackgroundColor(Color.Transparent));
        textLayer.SaveAsPng("textLayer.png");

        if (artLayer.Width != textLayer.Width || artLayer.Height != textLayer.Height)
        {
            artLayer.Dispose();
            textLayer.Dispose();
            throw new InvalidOperationException("Layered render output size mismatch");
        }

        if ((options.ExpectedWidth.HasValue && artLayer.Width != options.ExpectedWidth.Value) ||
            (options.ExpectedHeight.HasValue && artLayer.Height != options.ExpectedHeight.Value))
        {
            artLayer.Dispose();
            textLayer.Dispose();
            throw new InvalidOperationException("Layered render output does not match expected print dimensions");
        }

        var bleed = BleedAdder.CreateBleedImageWithMirroredEdges(artLayer, options.CardDimensions);

        //layer text on top of bleed
        //bleed.Mutate(ctx => ctx.DrawImage(textLayer, new Point(0, 0), new GraphicsOptions {BlendPercentage = 1.0f}));
        bleed.SaveAsPng("bleed.png");
        artLayer.Dispose(); // No longer needed after bleed creation.

        // Placeholder: assign baseline RGB ICC profile metadata (e.g., sRGB IEC61966-2.1).
        // Placeholder: perform additional preflight checks (safe bleed, alpha policy, profile compatibility).
        return new PrepressPipelineContext(bleed, textLayer, options);
    }

    private static Task Stage2GlobalColorAdjustmentsAsync(PrepressPipelineContext context, CancellationToken cancellationToken)
    {
        _ = context;
        _ = cancellationToken;
        // Placeholder: apply saturation/contrast/brightness in RGB space before CMYK conversion.
        // Example future hooks:
        // - context.ArtLayer.Mutate(ctx => ctx.Saturate(...).Contrast(...).Brightness(...));
        return Task.CompletedTask;
    }

    private static Task Stage3SeparationAndIccConversionAsync(PrepressPipelineContext context, CancellationToken cancellationToken)
    {
        _ = context;
        _ = cancellationToken;
        // Placeholder: keep text/outline intent in isolated layer and convert artwork to target CMYK profile.
        // Example future hooks:
        // - rasterize vector-ish black from text layer to a K-mask
        // - convert art layer with target profile + rendering intent
        return Task.CompletedTask;
    }

    private static Task Stage4100KTrappingAndOverprintAsync(PrepressPipelineContext context, CancellationToken cancellationToken)
    {
        _ = context;
        _ = cancellationToken;
        // Placeholder: stamp K-only text/outline over converted artwork with overprint rules.
        // Goal: preserve underlying CMY values to avoid white halos around black text.
        return Task.CompletedTask;
    }

    private static async Task<Stream> Stage5FinalizeAndExportAsync(PrepressPipelineContext context, CancellationToken cancellationToken)
    {
        using (context)
        {
            using var stream = new MemoryStream();
            await context.TextLayer.SaveAsPngAsync(stream, cancellationToken);
            stream.Seek(0, SeekOrigin.Begin);
            return MergePrintReadyCard(context.MagickImage, stream, PrepressPipelineOptions.MPC);
        }
    }


    public static MemoryStream MergePrintReadyCard(MagickImage artLayer, Stream rgbTextStream, ColorProfile colorProfile)
    {
        // 1. Ensure art layer starts as sRGB
        artLayer.SetProfile(ColorProfile.SRGB);
        artLayer.HasAlpha = true;

        // 2. Load the flat RGB Text/Symbol Layer
        using var textLayerRgb = new MagickImage(rgbTextStream);

        // 3. Clone it to create a dedicated layer for Colored Elements
        using var colorElementsLayer = new MagickImage(textLayerRgb);
        uint rgbChannels = textLayerRgb.ChannelCount; // Should be 4 (RGBA)

        colorElementsLayer.Write("colorElementsLayer.png"); // Debug: inspect the cloned layer before separation
        textLayerRgb.Write("textLayerRgb.png");
        // --- SEPARATION PASS (IN RGB) ---
        using (var colorPixels = colorElementsLayer.GetPixels())
        using (var rgbPixels = textLayerRgb.GetPixels())
        {
            int count = 0;
            for (int y = 0; y < textLayerRgb.Height; y++)
            {
                for (int x = 0; x < textLayerRgb.Width; x++)
                {
                    var textPixel = rgbPixels.GetPixel(x, y);

                    // Because ImageSharp uses straight alpha, semi-transparent black edges 
                    // are still R=0,G=0,B=0, meaning this brilliant logic perfectly grabs 
                    // your text anti-aliasing!
                    var rgb = textPixel.ToColor();
                    bool isPureBlack = rgb.R == 0 && rgb.G == 0 && rgb.B == 0;

                    if (!isPureBlack && textPixel.GetChannel(3) > 0) // If it's not pure black and has some opacity, it's part of the color layer
                    {
                        //Log.Information("Found non-black pixel at ({X}, {Y}) with color {Color}.{Alpha} Moving it to the color layer.", x, y, textPixel.ToColor(), textPixel.GetChannel(3));
                        colorPixels.SetPixel(x, y, textPixel.ToArray());
                        //rgbPixels.SetPixel(x, y, clear.ToByteArray());
                    }
                }
            }
            Log.Information("Separation pass complete. Identified {Count} pure black pixels.", count);
        }

        colorElementsLayer.Write("colorElementsLayer_afterSeparation.png"); // Debug: inspect the color layer after separation
        textLayerRgb.Write("textLayer_afterSeparation.png"); // Debug: inspect the text layer after separation
        // --- MERGE COLORED SYMBOLS IN RGB ---
        // Composite the colored mana symbols while still in RGB space so alpha blends perfectly!
        artLayer.Composite(colorElementsLayer, CompositeOperator.Over);

        // --- CONVERT THE FLATTENED IMAGE TO CMYK ---
        // Use TransformProfile instead of TransformColorSpace. It's the industry standard 
        // for applying specific ICC files safely.
        artLayer.TransformColorSpace(colorProfile);
        artLayer.ColorSpace = ColorSpace.CMYK;
        artLayer.SetProfile(colorProfile);

        textLayerRgb.TransformColorSpace(colorProfile);
        textLayerRgb.ColorSpace = ColorSpace.CMYK;
        textLayerRgb.SetProfile(colorProfile);
        // --- OVERPRINT THE PURE BLACK ---
        var artChannels = artLayer.ChannelCount; // Should be 5 (CMYKA)
        textLayerRgb.HasAlpha = true; // Ensure alpha is preserved for overprint logic
        artLayer.Write("artLayer_afterConversion.tiff"); // Debug: inspect the art layer after CMYK conversion
        
        
        // 2. Direct K-Channel Injection
        using (var artPixels = artLayer.GetPixels())
        using (var textPixels = textLayerRgb.GetPixels())
        {
            var channels =(int) artPixels.Channels;
            var kIdx =(int) artPixels.GetChannelIndex(PixelChannel.Black);
            var aIdx =(int) textPixels.GetChannelIndex(PixelChannel.Alpha);

            for (int y = 0; y < artLayer.Height; y++)
            {
                var artRow = artPixels.GetArea(0, y, artLayer.Width, 1);
                var textRow = textPixels.GetArea(0, y, textLayerRgb.Width, 1);

                for (int x = 0; x < artLayer.Width; x++)
                {
                    var offset = x * channels;
            
                    // Apply your 80% threshold logic directly to the raw byte (0.8 * 255 = 204)
                    if (textRow[offset + kIdx] > 204 && textRow[offset + aIdx] > 0)
                    {
                        double alphaRatio = textRow[offset + aIdx] / 255.0;
                        byte backgroundK = artRow[offset + kIdx];
                
                        // Boost ONLY the K channel based on the text's alpha, leaving C, M, and Y perfectly intact
                        artRow[offset + kIdx] = (byte)((backgroundK * (1.0 - alphaRatio)) + (255 * alphaRatio));

                        if (textRow[offset + aIdx] > 250)
                        {
                            //set CYM to 0
                            artRow[offset] = 0; // C
                            artRow[offset + 1] = 0; // M
                            artRow[offset + 2] = 0; // Y
                        }
                    }
                }
                artPixels.SetArea(0, y, artLayer.Width, 1, artRow);
            }
        }

        if (false)
        {
            var bytes = new byte[] {0, 0, 0, 0, 0}; // CMYKA all zero for non-black pixels
            foreach (var pixel in textLayerRgb.GetPixels())
            {
                var magickColor = pixel.ToColor();
                if (magickColor == null)
                    continue;

                if (magickColor.K > (0.8 * byte.MaxValue))
                {
                    if (magickColor.A > 230)
                    {
                        // If it's pure black and mostly opaque, set alpha to 0 to make it fully transparent in the color layer
                        //    pixel.SetChannel(0, 0);
                        //    pixel.SetChannel(1, 0);
                        //   pixel.SetChannel(2, 0);
                        pixel.SetChannel(3, 255); // Keep alpha as is for overprinting
                    }
                    else
                    {
                        // If it's pure black but semi-transparent, we can choose to either keep it or make it fully transparent.
                        // For this example, we'll make it fully transparent to avoid muddying the CMYK conversion.
                        //   pixel.SetChannel(4, 0); // Make fully transparent
                    }
                }
                else
                {
                    //pixel.SetValues(bytes); // Clear CMY channels and alpha for non-black pixels
                }
            }

            textLayerRgb.Write("textLayer_afterConversion.tiff"); // Debug: inspect the text layer after CMYK conversion
            artLayer.Composite(textLayerRgb, CompositeOperator.Over); // Overprint the black text using the alpha channel as a mask
        }

        if (false)
        {
            using (var artPixels = artLayer.GetPixels())
            using (var rgbPixels = textLayerRgb.GetPixels())
            {
                for (int y = 0; y < artLayer.Height; y++)
                {
                    var artRow = artPixels.GetArea(0, y, artLayer.Width, 1);
                    var rgbRow = rgbPixels.GetArea(0, y, textLayerRgb.Width, 1);

                    for (int x = 0; x < artLayer.Width; x++)
                    {
                        var rgbOffset = x * rgbChannels;
                        var r = rgbRow[rgbOffset];
                        var g = rgbRow[rgbOffset + 1];
                        var b = rgbRow[rgbOffset + 2];
                        var a = rgbRow[rgbOffset + 3];

                        bool isPureBlack = (r == g && g == b && r <= 1);

                        if (isPureBlack && a > 0)
                        {
                            var artOffset = x * artChannels;

                            // We use 255.0 because we are using Q8 (8-bit)
                            double alphaRatio = a / 255.0;
                            byte backgroundK = artRow[artOffset + 3];

                            // CRITICAL FIX: Only modify the K channel!
                            // Do NOT set C, M, and Y to 0. Leave them exactly as they are.
                            byte newK = (byte)((backgroundK * (1.0 - alphaRatio)) + (255 * alphaRatio));

                            artRow[artOffset + 3] = newK;
                        }
                    }

                    artPixels.SetArea(0, y, artLayer.Width, 1, artRow);
                }
            }
        }

        // --- FINAL EXPORT ---
        artLayer.SetProfile(colorProfile); // Embed the metadata
        artLayer.Density = new Density(800, 800, DensityUnit.PixelsPerInch);
        artLayer.HasAlpha = false;

        artLayer.Write("output.pdf");

        artLayer.Format = MagickFormat.Tiff;
        artLayer.Settings.Compression = CompressionMethod.LZW;
        var outStream = new MemoryStream();
        artLayer.Write(outStream, MagickFormat.Tiff);
        return outStream;
    }

    private sealed class PrepressPipelineContext : IDisposable
    {
        public PrepressPipelineContext(Image<Rgba32> artLayer, Image<Rgba32> textLayer, PrepressPipelineOptions options)
        {
            ArtLayer = artLayer;
            TextLayer = textLayer;
            _ = options;
            using var memStream = new MemoryStream();
            artLayer.SaveAsPng(memStream);
            memStream.Seek(0, SeekOrigin.Begin);
            MagickImage = new MagickImage(memStream);
            MagickImage.SetProfile(ColorProfiles.SRGB);
            MagickImage.ColorSpace = ColorProfiles.SRGB.ColorSpace;
            MagickImage.HasAlpha = true;
            Options = options;
        }

        public Image<Rgba32> ArtLayer { get; }
        public Image<Rgba32> TextLayer { get; }
        public MagickImage? MagickImage { get; private set; }
        public PrepressPipelineOptions Options { get; }

        public void Dispose()
        {
            ArtLayer.Dispose();
            TextLayer.Dispose();
        }
    }
}