using Serilog;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Png.Chunks;
using SixLabors.ImageSharp.Metadata;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CardConjurer.Models.CardImage.Sizing;

/// <summary>
///     Extension methods for <see cref="Image{TPixel}" /> that support common card-image operations
///     such as edge detection, transparency mirroring, metadata I/O, and PNG encoding.
/// </summary>
public static class MyImageExtensions
{
    /// <summary>
    ///     Shared drawing options used by helper rendering operations.
    /// </summary>
    public static readonly DrawingOptions DrawingOptions = new()
    {
        GraphicsOptions = new GraphicsOptions
        {
            Antialias = true,
            AlphaCompositionMode = PixelAlphaCompositionMode.DestOut
        }
    };

    /// <summary>
    ///     Quality-first PNG encoder that preserves full color — no alpha channel.
    /// </summary>
    public static readonly PngEncoder PngEncoder = new()
    {
        ColorType = PngColorType.Rgb,
        CompressionLevel = PngCompressionLevel.BestCompression,
        FilterMethod = PngFilterMethod.Adaptive,
        BitDepth = PngBitDepth.Bit8
    };

    /// <summary>
    ///     Quality-first PNG encoder for images that require an alpha channel.
    /// </summary>
    public static readonly PngEncoder PngEncoderAlpha = new()
    {
        ColorType = PngColorType.RgbWithAlpha,
        CompressionLevel = PngCompressionLevel.BestCompression,
        FilterMethod = PngFilterMethod.Adaptive,
        BitDepth = PngBitDepth.Bit8
    };

    /// <summary>
    ///     Returns a clone of <paramref name="image" /> with rounded corners applied via an alpha mask.
    /// </summary>
    /// <param name="image">The source image.</param>
    /// <param name="cornerRadius">Corner radius in pixels.</param>
    /// <returns>A new image with transparent rounded corners.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static Image<Rgba32> RoundCornersSimple(this Image<Rgba32> image, float cornerRadius)
    {
        ArgumentNullException.ThrowIfNull(image);

        var result = image.Clone();
        result.Mutate(ctx =>
        {
            var corners = BuildCorners(image.Width, image.Height, cornerRadius);
            ctx.Fill(DrawingOptions, Color.White, corners);
        });
        return result;
    }

    private static PathCollection BuildCorners(int imageWidth, int imageHeight, float cornerRadius)
    {
        var rect = new RectangularPolygon(-0.5f, -0.5f, cornerRadius, cornerRadius);
        var cornerTopLeft = rect.Clip(new EllipsePolygon(cornerRadius - 0.5f, cornerRadius - 0.5f, cornerRadius));

        var rightPos = imageWidth - cornerTopLeft.Bounds.Width + 1;
        var bottomPos = imageHeight - cornerTopLeft.Bounds.Height + 1;

        var cornerTopRight = cornerTopLeft.RotateDegree(90).Translate(rightPos, 0);
        var cornerBottomLeft = cornerTopLeft.RotateDegree(-90).Translate(0, bottomPos);
        var cornerBottomRight = cornerTopLeft.RotateDegree(180).Translate(rightPos, bottomPos);

        return new PathCollection(cornerTopLeft, cornerBottomLeft, cornerTopRight, cornerBottomRight);
    }

    /// <summary>
    ///     Returns <c>true</c> if every pixel in the specified row has RGB values at or below the black threshold (10).
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <param name="y">Zero-based row index.</param>
    /// <returns><see langword="true" /> if the row is effectively black.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static bool IsRowBlack(this Image<Rgba32> image, int y)
    {
        ArgumentNullException.ThrowIfNull(image);

        for (var x = 0; x < image.Width; x++)
        {
            var pixel = image[x, y];
            if (pixel.R > 10 || pixel.G > 10 || pixel.B > 10) return false;
        }

        return true;
    }

    /// <summary>
    ///     Returns <c>true</c> if every pixel in the specified column has RGB values at or below the black threshold (10).
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <param name="x">Zero-based column index.</param>
    /// <returns><see langword="true" /> if the column is effectively black.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static bool IsColumnBlack(this Image<Rgba32> image, int x)
    {
        ArgumentNullException.ThrowIfNull(image);

        for (var y = 0; y < image.Height; y++)
        {
            var pixel = image[x, y];
            if (pixel.R > 10 || pixel.G > 10 || pixel.B > 10) return false;
        }

        return true;
    }

    /// <summary>
    ///     Returns the row index of the last non-black row when scanning from the image bottom upward.
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <returns>
    ///     Zero-based row index of the last non-black row, or <c>-1</c> if every row is black.
    /// </returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static int LastNonBlackRowFromBottom(this Image<Rgba32> image)
    {
        ArgumentNullException.ThrowIfNull(image);

        var result = -1;
        image.ProcessPixelRows(accessor =>
        {
            for (var y = accessor.Height - 1; y >= 0; y--)
            {
                var row = accessor.GetRowSpan(y);
                var rowIsBlack = true;
                for (var xi = 0; xi < row.Length; xi++)
                {
                    var pixel = row[xi];
                    if (pixel.R > 10 || pixel.G > 10 || pixel.B > 10)
                    {
                        rowIsBlack = false;
                        break;
                    }
                }

                if (!rowIsBlack)
                {
                    result = y;
                    break;
                }
            }
        });
        return result;
    }

    /// <summary>
    ///     Returns the column index of the last non-black column when scanning from the right edge inward.
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <returns>
    ///     Zero-based column index of the last non-black column, or <c>-1</c> if every column is black.
    /// </returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static int LastNonBlackColumnFromRight(this Image<Rgba32> image)
    {
        ArgumentNullException.ThrowIfNull(image);

        var result = -1;
        image.ProcessPixelRows(accessor =>
        {
            for (var xi = accessor.Width - 1; xi >= 0; xi--)
            {
                var columnIsBlack = true;
                for (var yi = 0; yi < accessor.Height; yi++)
                {
                    var pixel = accessor.GetRowSpan(yi)[xi];
                    if (pixel.R > 10 || pixel.G > 10 || pixel.B > 10)
                    {
                        columnIsBlack = false;
                        break;
                    }
                }

                if (!columnIsBlack)
                {
                    result = xi;
                    break;
                }
            }
        });
        return result;
    }

    /// <summary>
    ///     Returns the column index of the first non-black column when scanning from the left edge inward.
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <returns>
    ///     Zero-based column index of the first non-black column, or <c>-1</c> if every column is black.
    /// </returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static int FirstNonBlackColumnFromLeft(this Image<Rgba32> image)
    {
        ArgumentNullException.ThrowIfNull(image);

        var result = -1;
        image.ProcessPixelRows(accessor =>
        {
            for (var xi = 0; xi < accessor.Width; xi++)
            {
                var columnIsBlack = true;
                for (var yi = 0; yi < accessor.Height; yi++)
                {
                    var pixel = accessor.GetRowSpan(yi)[xi];
                    if (pixel.R > 10 || pixel.G > 10 || pixel.B > 10)
                    {
                        columnIsBlack = false;
                        break;
                    }
                }

                if (!columnIsBlack)
                {
                    result = xi;
                    break;
                }
            }
        });
        return result;
    }

    /// <summary>
    ///     Returns <c>true</c> if any pixel in the requested column is not fully opaque.
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <param name="x">Zero-based column index.</param>
    /// <returns><see langword="true" /> if the column contains at least one transparent pixel.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static bool ColumnHasTransparency(this Image<Rgba32> image, int x)
    {
        ArgumentNullException.ThrowIfNull(image);

        var hasTransparency = false;
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < accessor.Height; y++)
            {
                var a = accessor.GetRowSpan(y)[x].A;
                //Log.Information("Checking pixel at ({X}, {Y}): A={A}", x, y, a);
                if (a < 255)
                {
                    hasTransparency = true;
                    break;
                }
                
            }
        });
        return hasTransparency;
    }

    /// <summary>
    ///     Returns <c>true</c> if any pixel in the requested row is not fully opaque.
    /// </summary>
    /// <param name="image">The image to inspect.</param>
    /// <param name="y">Zero-based row index.</param>
    /// <returns><see langword="true" /> if the row contains at least one transparent pixel.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static bool RowHasTransparency(this Image<Rgba32> image, int y)
    {
        ArgumentNullException.ThrowIfNull(image);

        var hasTransparency = false;
        image.ProcessPixelRows(accessor =>
        {
            var pixelRow = accessor.GetRowSpan(y);
            for (var x = 0; x < pixelRow.Length; x++)
                if (pixelRow[x].A < 255)
                {
                    hasTransparency = true;
                    break;
                }
        });
        return hasTransparency;
    }

    /// <summary>
    ///     Applies resolution metadata from <paramref name="dimensions" /> to the image's horizontal and vertical DPI.
    /// </summary>
    /// <param name="image">The image to update.</param>
    /// <param name="dimensions">The source of DPI information.</param>
    /// <exception cref="ArgumentNullException">Thrown when either parameter is null.</exception>
    public static void SetMetaData(this Image image, IBasicCardDimensions dimensions)
    {
        ArgumentNullException.ThrowIfNull(image);
        ArgumentNullException.ThrowIfNull(dimensions);

        image.Metadata.HorizontalResolution = dimensions.Dpi;
        image.Metadata.VerticalResolution = dimensions.Dpi;
        image.Metadata.ResolutionUnits = PixelResolutionUnit.PixelsPerInch;
    }

    /// <summary>
    ///     Applies resolution metadata from <paramref name="dimensions" /> to a 24-bit RGB image.
    /// </summary>
    /// <param name="image">The image to update.</param>
    /// <param name="dimensions">The source of DPI information.</param>
    /// <exception cref="ArgumentNullException">Thrown when either parameter is null.</exception>
    public static void SetMetaData(this Image<Rgb24> image, IBasicCardDimensions dimensions)
    {
        ArgumentNullException.ThrowIfNull(image);
        ArgumentNullException.ThrowIfNull(dimensions);

        image.Metadata.HorizontalResolution = dimensions.Dpi;
        image.Metadata.VerticalResolution = dimensions.Dpi;
        image.Metadata.ResolutionUnits = PixelResolutionUnit.PixelsPerInch;
    }

    /// <summary>
    ///     Saves the image to <paramref name="path" /> using the library's quality-first <see cref="PngEncoder" />.
    /// </summary>
    /// <param name="image">The image to save.</param>
    /// <param name="path">Destination file path.</param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> or <paramref name="path" /> is null.</exception>
    public static void SaveAsPng(this Image<Rgba32> image, string path)
    {
        ArgumentNullException.ThrowIfNull(image);
        ArgumentNullException.ThrowIfNull(path);

        image.Save(path, PngEncoder);
    }

    /// <summary>
    ///     Draws <paramref name="imageToDraw" /> centred on <paramref name="image" /> using source-over compositing.
    /// </summary>
    /// <param name="image">The canvas image to draw onto.</param>
    /// <param name="imageToDraw">The image to draw.</param>
    /// <exception cref="ArgumentNullException">Thrown when either parameter is null.</exception>
    public static void DrawImageInCenter(this Image<Rgba32> image, Image<Rgba32> imageToDraw)
    {
        ArgumentNullException.ThrowIfNull(image);
        ArgumentNullException.ThrowIfNull(imageToDraw);

        var x = (image.Width - imageToDraw.Width) / 2;
        var y = (image.Height - imageToDraw.Height) / 2;
        image.Mutate(ctx => ctx.DrawImage(imageToDraw, new Point(x, y), new GraphicsOptions
        {
            Antialias = true,
            AlphaCompositionMode = PixelAlphaCompositionMode.Src,
            BlendPercentage = 1f
        }));
    }

    /// <summary>
    /// <summary>
    ///     Fills outer edges that contain any transparency by mirroring adjacent opaque content behind existing pixels.
    ///     Scans from each edge inward, counting columns/rows that have at least one transparent pixel (A &lt; 255).
    ///     The mirrored strip is composited with <see cref="PixelAlphaCompositionMode.DestOver"/> so existing
    ///     partially-transparent content is preserved on top.
    /// </summary>
    /// <remarks>
    ///     Processing order is: fill fully transparent bottom rows with black, mirror top,
    ///     then mirror left/right so columns are measured from meaningful content.
    /// </remarks>
    /// <param name="cutImage">The image to modify in place.</param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="cutImage" /> is null.</exception>
    public static void MirrorTransparentEdges(this Image<Rgba32> cutImage)
    {
        ArgumentNullException.ThrowIfNull(cutImage);

        if (cutImage.Width <= 1 || cutImage.Height <= 1)
        {
            Log.Error("Image is too small to mirror edges: {Width}x{Height}", cutImage.Width, cutImage.Height);
            return;
        }

        // Some renders include a fully transparent footer strip. That makes every column
        // appear "transparent" for left/right scans. Fill that footer first so edge scans
        // use the actual card content.
        FillFullyTransparentRowsFromBottomWithBlack(cutImage);


        var topGapHeight = CountRowsWithTransparencyFromTop(cutImage);
        var bottomGapHeight = 0;
        
        var opaqueHeight = cutImage.Height - topGapHeight - bottomGapHeight;
        if (opaqueHeight <= 0) return;

        if (topGapHeight > 0)
        {
            var remaining = topGapHeight;
            while (remaining > 0)
            {
                var chunkHeight = Math.Min(remaining, opaqueHeight);
                using var topStrip = cutImage.Clone(x => x.Crop(new Rectangle(0, topGapHeight, cutImage.Width, chunkHeight)).Flip(FlipMode.Vertical));
                var destY = remaining - chunkHeight;
                cutImage.Mutate(x => x.DrawImage(topStrip, new Point(0, destY), PixelColorBlendingMode.Normal, PixelAlphaCompositionMode.DestOver, 1f));
                remaining -= chunkHeight;
            }
        }

        var leftGapWidth = CountColumnsWithTransparencyFromLeft(cutImage);
        var rightGapWidth = CountColumnsWithTransparencyFromRight(cutImage);
        var opaqueWidth = cutImage.Width - leftGapWidth - rightGapWidth;
        if (opaqueWidth <= 0) return;
        Log.Information("Mirroring transparent edges: left={LeftGapWidth}, right={RightGapWidth}, top={TopGapHeight}, bottom={BottomGapHeight}",
            leftGapWidth, rightGapWidth, topGapHeight, bottomGapHeight);

        if (leftGapWidth > 0)
        {
            var remaining = leftGapWidth;
            while (remaining > 0)
            {
                var chunkWidth = Math.Min(remaining, opaqueWidth);
                using var leftStrip = cutImage.Clone(x => x.Crop(new Rectangle(leftGapWidth, 0, chunkWidth, cutImage.Height)).Flip(FlipMode.Horizontal));
                var destX = remaining - chunkWidth;
                cutImage.Mutate(x => x.DrawImage(leftStrip, new Point(destX, 0), PixelColorBlendingMode.Normal, PixelAlphaCompositionMode.DestOver, 1f));
                remaining -= chunkWidth;
            }
        }

        if (rightGapWidth > 0)
        {
            var remaining = rightGapWidth;
            var destStartX = cutImage.Width - rightGapWidth;
            while (remaining > 0)
            {
                var chunkWidth = Math.Min(remaining, opaqueWidth);
                using var rightStrip = cutImage.Clone(x => x.Crop(new Rectangle(cutImage.Width - rightGapWidth - chunkWidth, 0, chunkWidth, cutImage.Height)).Flip(FlipMode.Horizontal));
                var drawn = rightGapWidth - remaining;
                cutImage.Mutate(x => x.DrawImage(rightStrip, new Point(destStartX + drawn, 0), PixelColorBlendingMode.Normal, PixelAlphaCompositionMode.DestOver, 1f));
                remaining -= chunkWidth;
            }
        }

        
    }

    private static void FillFullyTransparentRowsFromBottomWithBlack(Image<Rgba32> image)
    {
        var filledRows = 0;

        image.ProcessPixelRows(accessor =>
        {
            for (var y = accessor.Height - 1; y >= (accessor.Height * 0.75); y--)
            {
                var row = accessor.GetRowSpan(y);
                var isFullyTransparent = true;
                for (var x = 0; x < row.Length; x++)
                {
                    if (row[x].A != 0)
                    {
                        isFullyTransparent = false;
                        break;
                    }
                }

                if (!isFullyTransparent)
                {
                    break;
                }

                for (var x = 0; x < row.Length; x++)
                {
                    row[x] = new Rgba32(0, 0, 0, 255);
                }

                filledRows++;
            }
        });

        if (filledRows > 0)
        {
            Log.Information("Filled {FilledRows} fully transparent bottom rows with black before edge mirroring", filledRows);
        }
    }

    /// <summary>Counts consecutive columns from the left edge that contain at least one pixel with A &lt; 255.</summary>
    private static int CountColumnsWithTransparencyFromLeft(Image<Rgba32> image)
    {
        for (var x = 0; x < image.Width/4; x++)
            if (!image.ColumnHasTransparency(x))
                return x;
        return image.Width;
    }

    /// <summary>Counts consecutive columns from the right edge that contain at least one pixel with A &lt; 255.</summary>
    private static int CountColumnsWithTransparencyFromRight(Image<Rgba32> image)
    {
        var gap = 0;
        for (var x = image.Width - 1; x >= (image.Width/4); x--)
        {
            if (!image.ColumnHasTransparency(x)) break;
            gap++;
        }

        return gap;
    }

    /// <summary>Counts consecutive rows from the top edge that contain at least one pixel with A &lt; 255.</summary>
    private static int CountRowsWithTransparencyFromTop(Image<Rgba32> image)
    {
        for (var y = 0; y < (image.Height/4); y++)
            if (!IsRowFullyTransparent(image, y))
                return y;
        return image.Height;
    }
    


    /// <summary>Counts consecutive rows from the bottom edge that contain at least one pixel with A &lt; 255.</summary>
    private static int CountRowsWithTransparencyFromBottom(Image<Rgba32> image)
    {
        var gap = 0;
        for (var y = image.Height - 1; y >= 0; y--)
        {
            if (!image.RowHasTransparency(y)) break;
            gap++;
        }

        return gap;
    }

    private static bool IsColumnFullyTransparent(Image<Rgba32> image, int x)
    {
        var isTransparent = true;
        image.ProcessPixelRows(accessor =>
        {
            for (var y = 0; y < (accessor.Height); y++)
                if (accessor.GetRowSpan(y)[x].A != 0)
                {
                    isTransparent = false;
                    break;
                }
        });
        return isTransparent;
    }

    private static bool IsRowFullyTransparent(Image<Rgba32> image, int y)
    {
        var isTransparent = true;
        image.ProcessPixelRows(accessor =>
        {
            var row = accessor.GetRowSpan(y);
            for (var x = 0; x < row.Length; x++)
                if (row[x].A != 0)
                {
                    isTransparent = false;
                    break;
                }
        });
        return isTransparent;
    }

    /// <summary>
    ///     Embeds key-value metadata into a PNG image's tEXt chunks.
    /// </summary>
    /// <param name="image">The image to update.</param>
    /// <param name="metadata">Metadata dictionary to embed.</param>
    /// <exception cref="ArgumentNullException">Thrown when either parameter is null.</exception>
    public static void AddMetadataToPng(this Image image, Dictionary<string, string> metadata)
    {
        ArgumentNullException.ThrowIfNull(image);
        ArgumentNullException.ThrowIfNull(metadata);

        var pngMetadata = image.Metadata.GetPngMetadata();
        foreach (var kvp in metadata)
            pngMetadata.TextData.Add(new PngTextData(kvp.Key, kvp.Value, string.Empty, string.Empty));
    }

    /// <summary>
    ///     Reads all tEXt chunk metadata from a PNG image.
    /// </summary>
    /// <param name="image">The image to read metadata from.</param>
    /// <returns>A dictionary of all embedded keyword/value pairs.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="image" /> is null.</exception>
    public static Dictionary<string, string> GetMetadataFromPng(this Image image)
    {
        ArgumentNullException.ThrowIfNull(image);

        var metadata = new Dictionary<string, string>();
        var pngMetadata = image.Metadata.GetPngMetadata();
        foreach (var textData in pngMetadata.TextData)
            metadata[textData.Keyword] = textData.Value;
        return metadata;
    }
}