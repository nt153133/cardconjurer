using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace CardConjurer.Services.CardImage;

/// <summary>
/// Two-tier SVG rasterization service.
/// • Small mana symbols: resolved by tag code, cached at vector (Tier 1) and raster (Tier 2) levels.
/// • Large card frames: rasterized on demand with no caching to avoid excessive memory pressure.
/// </summary>
public interface ISvgRasterizationService
{
    /// <summary>
    /// Resolves a mana symbol tag code (e.g. "w", "u/w", "3") to a rasterized RGBA image.
    /// The caller owns the returned clone and MUST dispose it.
    /// </summary>
    /// <param name="tagCode">Raw tag code from card JSON (slashes allowed, e.g. "u/w").</param>
    /// <param name="targetSize">Desired pixel height/width for square symbols (largest dimension for non-square).</param>
    /// <param name="manaPrefix">Optional prefix such as "outline", "breakingNews", etc.</param>
    /// <returns>A cloned Image&lt;Rgba32&gt; the caller must dispose, or null if the symbol is not found.</returns>
    Image<Rgba32>? GetManaSymbol(string tagCode, int targetSize, string? manaPrefix = null);

    /// <summary>
    /// Rasterizes a full-size SVG frame (e.g. card border art) to the requested dimensions.
    /// Not cached — the caller owns and must dispose the returned image.
    /// </summary>
    /// <param name="absoluteFilePath">Absolute path to the SVG file on disk.</param>
    /// <param name="targetWidth">Desired pixel width.</param>
    /// <param name="targetHeight">Desired pixel height.</param>
    /// <returns>An Image&lt;Rgba32&gt; the caller must dispose, or null if the file cannot be loaded.</returns>
    Task<Image<Rgba32>?> RasterizeFrameAsync(string absoluteFilePath, int targetWidth, int targetHeight);

    /// <summary>
    /// Returns the native (intrinsic) width and height of an SVG document in points/px,
    /// equivalent to the browser's <c>img.width</c> / <c>img.height</c> for an SVG loaded as an img element.
    /// Used to calculate zoom-based render dimensions matching the JS renderer's
    /// <c>setSymbol.width * card.setSymbolZoom</c> pattern.
    /// </summary>
    /// <param name="absoluteFilePath">Absolute path to the SVG file on disk.</param>
    /// <returns>Native (Width, Height) tuple, or null if the file cannot be parsed.</returns>
    (double Width, double Height)? GetSvgNativeDimensions(string absoluteFilePath);
    
    

    Image<Rgba32>? GetStyledVectorSymbol(string symbolKey, int targetSize, Color backgroundColor, Color foregroundColor);
}

