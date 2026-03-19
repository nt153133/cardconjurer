using Serilog;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CardConjurer.Models.CardImage.Sizing;

public static class BleedAdder
{
    /// <summary>
    ///     The expected size for a standard Card Conjurer card image without additional margins.
    /// </summary>
    public static readonly Size NormalCardConjurerSize = new(2010, 2814);

    /// <summary>
    ///     The expected size for a Card Conjurer card image that already includes its margin.
    /// </summary>
    public static readonly Size CardConjurerSizeWithMargin = new(2187, 2975);

    /// <summary>
    ///     Creates a bleed image by centering <paramref name="cutImage" /> and mirroring edge strips into the bleed area.
    /// </summary>
    /// <param name="cutImage">The source cut image.</param>
    /// <param name="dimensions">The target card dimensions containing bleed and cut sizes.</param>
    /// <returns>A new image at bleed dimensions with mirrored edge fill.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="cutImage" /> or <paramref name="dimensions" /> is null.</exception>
    /// <exception cref="ArgumentException">Thrown when bleed dimensions are smaller than the cut image.</exception>
    public static Image<Rgba32> CreateBleedImageWithMirroredEdges(Image<Rgba32> cutImage, IBasicCardDimensions dimensions)
    {
        ArgumentNullException.ThrowIfNull(cutImage);
        ArgumentNullException.ThrowIfNull(dimensions);

        var bleedWidth = dimensions.BleedSize.Width;
        var bleedHeight = dimensions.BleedSize.Height;
        if (bleedWidth < cutImage.Width || bleedHeight < cutImage.Height)
            throw new ArgumentException("Bleed dimensions must be at least as large as the cut image.", nameof(dimensions));

        var leftPad = (bleedWidth - cutImage.Width) / 2;
        var topPad = (bleedHeight - cutImage.Height) / 2;
        var rightPad = bleedWidth - cutImage.Width - leftPad;
        var bottomPad = bleedHeight - cutImage.Height - topPad;

        var bleedImage = new Image<Rgba32>(bleedWidth, bleedHeight);
        CopyResolutionMetadata(cutImage, bleedImage);

        // Compose center content and vertical bleed strips in one mutate pass.
        bleedImage.Mutate(ctx =>
        {
            ctx.Fill(Color.Black);
            ctx.DrawImage(cutImage, new Point(leftPad, topPad), 1f);

            if (topPad > 0)
            {
                using var topStrip = cutImage.Clone(x => x.Crop(new Rectangle(0, 0, cutImage.Width, topPad)).Flip(FlipMode.Vertical));
                ctx.DrawImage(topStrip, new Point(leftPad, 0), 1f);
            }

            if (bottomPad > 0)
            {
                using var bottomStrip = cutImage.Clone(x => x.Crop(new Rectangle(0, cutImage.Height - bottomPad, cutImage.Width, bottomPad)).Flip(FlipMode.Vertical));
                ctx.DrawImage(bottomStrip, new Point(leftPad, topPad + cutImage.Height), 1f);
            }
        });

        // Fill left/right bleed from the now-composed image (includes mirrored corners).
        if (leftPad > 0)
        {
            using var leftStrip = bleedImage.Clone(x => x.Crop(new Rectangle(leftPad, 0, leftPad, bleedHeight)).Flip(FlipMode.Horizontal));
            bleedImage.Mutate(ctx => ctx.DrawImage(leftStrip, new Point(0, 0), 1f));
        }

        if (rightPad > 0)
        {
            using var rightStrip = bleedImage.Clone(x => x.Crop(new Rectangle(leftPad + cutImage.Width - rightPad, 0, rightPad, bleedHeight)).Flip(FlipMode.Horizontal));
            bleedImage.Mutate(ctx => ctx.DrawImage(rightStrip, new Point(leftPad + cutImage.Width, 0), 1f));
        }

        return bleedImage;
    }

    /// <summary>
    ///     Resizes the cut image to the target cut size and adds bleed, mirroring non-black edges when needed.
    /// </summary>
    /// <param name="cutImage">The source image that will be resized in place before bleed generation.</param>
    /// <param name="dimensions">The target card dimensions.</param>
    /// <returns>A new image sized to bleed dimensions.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="cutImage" /> or <paramref name="dimensions" /> is null.</exception>
    public static Image<Rgba32> AddBleed(Image<Rgba32> cutImage, IBasicCardDimensions dimensions)
    {
        ArgumentNullException.ThrowIfNull(cutImage);
        ArgumentNullException.ThrowIfNull(dimensions);

        //ResizeToCutDimensions(cutImage, dimensions);



        // If the image already has black borders, fill bleed with black to avoid unnecessary mirroring work.
        if (cutImage.IsColumnBlack(0) && cutImage.IsColumnBlack(cutImage.Width - 1) &&
            cutImage.IsRowBlack(0) && cutImage.IsRowBlack(cutImage.Height - 1))
        {
            Log.Information("Cut image already has black borders, skipping edge mirroring for bleed generation.");
            var bleedImage = new Image<Rgba32>(dimensions.BleedSize.Width, dimensions.BleedSize.Height);
            CopyResolutionMetadata(cutImage, bleedImage);

            var x = (bleedImage.Width - cutImage.Width) / 2;
            var y = (bleedImage.Height - cutImage.Height) / 2;
            bleedImage.Mutate(ctx =>
            {
                ctx.Fill(Color.Black);
                ctx.DrawImage(cutImage, new Point(x, y), 1f);
            });

            return bleedImage;
        }
        
        //cutImage.SaveAsPngAsync("debug_cut_image_before_bleed.png", MyImageExtensions.PngEncoderAlpha).Wait();

        Log.Information("Adding bleed generation for bleed generation.");
        cutImage.MirrorTransparentEdges();

        return cutImage;
        //eturn CreateBleedImageWithMirroredEdges(cutImage, dimensions);
    }

    /// <summary>
    ///     Inspects a card image file and writes the number of black-pixel rows/columns on each edge to standard output.
    /// </summary>
    /// <param name="file">The image file to inspect.</param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="file" /> is null.</exception>
    /// <exception cref="FileNotFoundException">Thrown when <paramref name="file" /> does not exist.</exception>
    public static void CheckCrop(FileInfo file)
    {
        ArgumentNullException.ThrowIfNull(file);
        if (!file.Exists) throw new FileNotFoundException("Image file not found.", file.FullName);

        using var imageToCheck = Image.Load<Rgba32>(file.FullName);

        // Find first non-black column from the left.
        var left = 0;
        for (var x = 0; x < imageToCheck.Width; x++)
        {
            left = x;
            if (!imageToCheck.IsColumnBlack(x)) break;
        }

        // Find first non-black column from the right.
        var right = imageToCheck.Width;
        for (var x = imageToCheck.Width - 1; x >= 0; x--)
        {
            if (!imageToCheck.IsColumnBlack(x)) break;
            right = x;
        }

        // Find first non-black row from the top.
        var top = 0;
        for (var y = 0; y < imageToCheck.Height; y++)
        {
            top = y;
            if (!imageToCheck.IsRowBlack(y)) break;
        }

        // Find first non-black row from the bottom.
        var bottom = imageToCheck.Height;
        for (var y = imageToCheck.Height - 1; y >= 0; y--)
        {
            if (!imageToCheck.IsRowBlack(y)) break;
            bottom = y;
        }

        Console.WriteLine(
            $"Left: {left}, Right: {imageToCheck.Width - right}, Top: {top}, Bottom: {imageToCheck.Height - bottom}" +
            $" - {file.Name}  Aspect Ratio: {imageToCheck.Width / ((float)imageToCheck.Height - 37)}");
    }

    /// <summary>
    ///     Resizes <paramref name="cutImage" /> in place to match the target cut dimensions when required.
    /// </summary>
    /// <param name="cutImage">The image to resize.</param>
    /// <param name="dimensions">The target dimensions.</param>
    private static void ResizeToCutDimensions(Image<Rgba32> cutImage, IBasicCardDimensions dimensions)
    {
        if (cutImage.Width == dimensions.CutSize.Width && cutImage.Height == dimensions.CutSize.Height) return;

        if (cutImage.Width == CardConjurerSizeWithMargin.Width && cutImage.Height == CardConjurerSizeWithMargin.Height)
        {
            var scaleFactorX = (float)dimensions.CutSize.Width / NormalCardConjurerSize.Width;
            var scaleFactorY = (float)dimensions.CutSize.Height / NormalCardConjurerSize.Height;
            var scaledSize = new Size((int)MathF.Round(cutImage.Width * scaleFactorX), (int)MathF.Round(cutImage.Height * scaleFactorY));
            Log.Information("Resizing from known Card Conjurer size with margin {OriginalSize} to cut size {CutSize} using scale factor {ScaleFactorX}x{ScaleFactorY}",
                cutImage.Size, dimensions.CutSize, scaleFactorX, scaleFactorY);
            ResizeInPlace(cutImage, scaledSize);
        }
        else
        {
            ResizeInPlace(cutImage, dimensions.CutSize);
        }
    }

    /// <summary>
    ///     Applies one high-quality resize operation in place, skipping no-op sizes.
    /// </summary>
    /// <param name="image">The image to resize.</param>
    /// <param name="targetSize">The target dimensions.</param>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when <paramref name="targetSize" /> has a zero or negative dimension.</exception>
    private static void ResizeInPlace(Image<Rgba32> image, Size targetSize)
    {
        if (targetSize.Width <= 0 || targetSize.Height <= 0)
            throw new ArgumentOutOfRangeException(nameof(targetSize), "Target size must be greater than zero.");

        if (image.Width == targetSize.Width && image.Height == targetSize.Height) return;

        var resizeOptions = new ResizeOptions
        {
            Size = targetSize,
            Mode = ResizeMode.Stretch,
            Sampler = KnownResamplers.Lanczos8
        };

        image.Mutate(x => x.Resize(resizeOptions));
    }

    /// <summary>
    ///     Copies resolution metadata so generated bleed files keep source DPI information.
    /// </summary>
    /// <param name="source">Source image metadata provider.</param>
    /// <param name="target">Target image metadata receiver.</param>
    private static void CopyResolutionMetadata(Image<Rgba32> source, Image<Rgba32> target)
    {
        target.Metadata.HorizontalResolution = source.Metadata.HorizontalResolution;
        target.Metadata.VerticalResolution = source.Metadata.VerticalResolution;
        target.Metadata.ResolutionUnits = source.Metadata.ResolutionUnits;
    }
}