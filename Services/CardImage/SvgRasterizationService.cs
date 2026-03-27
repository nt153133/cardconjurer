using System.Collections.Concurrent;
using System.Xml;
using Microsoft.Extensions.Caching.Memory;
using Serilog;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using VectSharp;
using VectSharp.Raster.ImageSharp;
using VectSharp.SVG;

namespace CardConjurer.Services.CardImage;

/// <summary>
/// SVG rasterization service with a two-tier cache for mana symbols and
/// uncached on-demand rasterization for full-size card frames.
///
/// Tier 1 (Vector):  ConcurrentDictionary&lt;string, Page&gt; — parsed SVG pages, lives forever.
/// Tier 2 (Raster):  IMemoryCache — Image&lt;Rgba32&gt; keyed by symbol+size, auto-disposed on eviction.
///
/// Thread-safety:
///   • Tier 1 uses ConcurrentDictionary + per-key SemaphoreSlim to prevent duplicate SVG parses.
///   • Tier 2 uses IMemoryCache.GetOrCreate with a per-key SemaphoreSlim to prevent duplicate rasterization.
///   • All returned images are .Clone() copies so callers cannot corrupt the cache.
///   • Frame rasterization uses a global SemaphoreSlim to serialize heavy work and bound memory.
/// </summary>
public sealed class SvgRasterizationService : ISvgRasterizationService, IDisposable
{
    // ── Configuration ────────────────────────────────────────────────────
    private static readonly TimeSpan RasterCacheSlidingExpiration = TimeSpan.FromMinutes(5);
    private const int MaxConcurrentFrameRasterizations = 2;

    // ── Tier 1: Vector cache (symbol name → parsed VectSharp Page) ──────
    private readonly ConcurrentDictionary<string, Page> _vectorCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _vectorLocks = new(StringComparer.OrdinalIgnoreCase);

    // ── Tier 2: Raster cache (IMemoryCache, keyed "mana_{symbolKey}_{size}") ──
    private readonly IMemoryCache _rasterCache;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _rasterLocks = new(StringComparer.OrdinalIgnoreCase);

    // ── Symbol file index (symbol name → absolute file path) ────────────
    private readonly Dictionary<string, string> _symbolIndex;

    // ── Frame rasterization throttle ────────────────────────────────────
    private readonly SemaphoreSlim _frameGate = new(MaxConcurrentFrameRasterizations, MaxConcurrentFrameRasterizations);

    public SvgRasterizationService(IWebHostEnvironment environment, IMemoryCache memoryCache)
    {
        _rasterCache = memoryCache;

        var webRoot = environment.WebRootPath ?? environment.ContentRootPath;
        var manaRoot = Path.Combine(webRoot, "img", "manaSymbols");
        _symbolIndex = BuildSymbolIndex(manaRoot);

        Log.Information("SvgRasterizationService initialized. Indexed {Count} mana symbol files from {Root}",
            _symbolIndex.Count, manaRoot);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Responsibility 1: Mana Symbol Resolution & Caching
    // ═════════════════════════════════════════════════════════════════════

    public Image<Rgba32>? GetManaSymbol(string tagCode, int targetSize, string? manaPrefix = null)
    {
        if (string.IsNullOrWhiteSpace(tagCode) || targetSize <= 0)
            return null;

        // Step 1: Clean the tag — strip slashes, lowercase
        var cleanTag = tagCode.Replace("/", "").ToLowerInvariant();
        var reversedTag = Reverse(cleanTag);

        // Step 2: Resolve the symbol key (file index key that exists on disk)
        var symbolKey = ResolveSymbolKey(cleanTag, reversedTag, manaPrefix);
        if (symbolKey is null)
            return null;

        // Step 3: Build the Tier 2 cache key
        var rasterKey = $"mana_{symbolKey}_{targetSize}";

        // Step 4: Try Tier 2 cache (fast path)
        if (_rasterCache.TryGetValue(rasterKey, out Image<Rgba32>? cached) && cached is not null)
        {
            return cached.Clone();
        }

        // Step 5: Acquire per-key lock to prevent duplicate rasterization
        var rasterLock = _rasterLocks.GetOrAdd(rasterKey, _ => new SemaphoreSlim(1, 1));
        rasterLock.Wait();
        try
        {
            // Double-check after acquiring lock
            if (_rasterCache.TryGetValue(rasterKey, out cached) && cached is not null)
            {
                return cached.Clone();
            }

            // Step 6 & 7: Rasterize or Resize based on file type
            Image<Rgba32> rasterized;
            var filePath = _symbolIndex[symbolKey];

            if (filePath.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
            {
                var page = GetOrLoadPage(symbolKey);
                if (page is null) return null;

                var scale = CalculateScale(page, targetSize);
                if (scale <= 0) return null;

                rasterized = page.SaveAsImage(scale);
            }
            else
            {
                // It's a PNG! Load directly from disk.
                // We don't use Tier 1 caching for raw ImageSharp images to prevent unmanaged memory leaks.
                // The OS disk cache makes loading tiny PNGs instantaneous anyway.
                using var rawImage = Image.Load<Rgba32>(filePath);

                var scale = (double)targetSize / Math.Max(rawImage.Width, rawImage.Height);
                int newW = Math.Max(1, (int)Math.Round(rawImage.Width * scale));
                int newH = Math.Max(1, (int)Math.Round(rawImage.Height * scale));

                rasterized = rawImage.Clone(ctx => ctx.Resize(newW, newH, KnownResamplers.Lanczos3));
            }


            // Step 8: Store in Tier 2 cache with eviction callback to dispose
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetSlidingExpiration(RasterCacheSlidingExpiration)
                .RegisterPostEvictionCallback(static (key, value, reason, _) =>
                {
                    if (value is IDisposable disposable)
                    {
                        disposable.Dispose();
                        Log.Debug("Disposed evicted mana symbol raster cache entry: {Key} (reason: {Reason})", key, reason);
                    }
                });

            _rasterCache.Set(rasterKey, rasterized, cacheOptions);

            // Step 9: Return a clone — the cache owns the original
            return rasterized.Clone();
        }
        finally
        {
            rasterLock.Release();
        }
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Responsibility 2: Full Frame Rasterization (no caching)
    // ═════════════════════════════════════════════════════════════════════

    /// <inheritdoc/>
    public (double Width, double Height)? GetSvgNativeDimensions(string absoluteFilePath)
    {
        if (string.IsNullOrWhiteSpace(absoluteFilePath) || !File.Exists(absoluteFilePath))
            return null;

        try
        {
            // Parser.FromFile is CPU-bound but fast (no rasterization); safe to call on calling thread.
            var page = Parser.FromFile(absoluteFilePath);
            if (page.Width > 0 && page.Height > 0)
                return (page.Width, page.Height);

            Log.Warning("SVG has zero or negative dimensions: {Path} ({W}x{H})", absoluteFilePath, page.Width, page.Height);
            return null;
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to read native SVG dimensions: {Path}", absoluteFilePath);
            return null;
        }
    }

    public async Task<Image<Rgba32>?> RasterizeFrameAsync(string absoluteFilePath, int targetWidth, int targetHeight)
    {
        if (string.IsNullOrWhiteSpace(absoluteFilePath) || targetWidth <= 0 || targetHeight <= 0)
        {
            Log.Error("Invalid parameters for RasterizeFrameAsync: {Path}, {W}x{H}", absoluteFilePath, targetWidth, targetHeight);
            return null;
        }

        if (!File.Exists(absoluteFilePath))
        {
            Log.Warning("SVG frame file not found: {Path}", absoluteFilePath);
            return null;
        }

        // Throttle concurrent frame rasterizations to bound peak memory usage
        await _frameGate.WaitAsync();
        try
        {
            // Parse on a thread-pool thread (VectSharp SVG parsing is CPU-bound)
            return await Task.Run(() =>
            {
                Page page;
                try
                {
                    page = Parser.FromFile(absoluteFilePath);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to parse SVG frame: {Path}", absoluteFilePath);
                    return null;
                }

                if (page.Width <= 0 || page.Height <= 0)
                {
                    Log.Warning("SVG frame has zero dimensions: {Path} ({W}x{H})", absoluteFilePath, page.Width, page.Height);
                    return null;
                }

                // Use the larger of width/height scale ratios to fully cover the target,
                // then the caller can crop or composite as needed.
                var scaleX = targetWidth / page.Width;
                var scaleY = targetHeight / page.Height;
                var scale = Math.Max(scaleX, scaleY);

                if (scale <= 0)
                {
                    Log.Error("Calculated non-positive scale for SVG frame: {Path} at target {W}x{H} (page {PW}x{PH})", absoluteFilePath, targetWidth, targetHeight, page.Width, page.Height);
                    return null;
                }

                try
                {
                    Log.Information("Rasterizing SVG frame: {Path} at target {W}x{H} with scale {Scale}", absoluteFilePath, targetWidth, targetHeight, scale);
                    var img= page.SaveAsImage(scale);
                    if (img == null)
                    {
                        Log.Error("VectSharp failed to rasterize SVG frame: {Path} at scale {Scale}", absoluteFilePath, scale);
                        Log.Information($"{page.Graphics.TryRasterise(page.Graphics.GetBounds(),1,true, out var debugImg)}");
                        
                    }
                    return img;
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to rasterize SVG frame: {Path} at scale {Scale}", absoluteFilePath, scale);
                    return null;
                }
            });
        }
        finally
        {
            _frameGate.Release();
        }
    }

    public Image<Rgba32>? GetStyledVectorSymbol(string symbolKey, int targetSize, Color backgroundColor, Color foregroundColor)
    {
        // 1. Resolve the file path from the index
        if (!_symbolIndex.TryGetValue(symbolKey, out var filePath))
        {
            Log.Error("Symbol key not found in index for styled vector symbol: {SymbolKey}", symbolKey);
            return null;
        }

        if (!filePath.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
        {
            Log.Warning("Attempted to vector-style a non-SVG symbol: {FilePath}", filePath);
            return null;
        }
        string svgContent = File.ReadAllText(filePath);
        try
        {
            // 2. Load the raw SVG text directly from disk (bypassing the Tier 1 cache)
            

            // 3. Extract ImageSharp Color values
            var fgPixel = foregroundColor.ToPixel<Rgba32>();
            var bgPixel = backgroundColor.ToPixel<Rgba32>();

            // 4. Inject CSS to force the foreground color on all vector paths!
            // We use rgba() so it perfectly respects any alpha transparency passed from ImageSharp
            Dictionary<string, string> styleValues = new Dictionary<string, string>()
            {
                {"fill", $"rgb({fgPixel.R}, {fgPixel.G}, {fgPixel.B})"},
            };

            svgContent = SetStyle(svgContent, styleValues).TrimStart('?');

            // 5. Parse the manipulated SVG string into a VectSharp Page
            Page page = Parser.FromString(svgContent);

            // 6. Set the background color natively on the VectSharp Page
            // This will fill the document bounds behind the vector graphics
            page.Background = Colour.FromRgba(bgPixel.R, bgPixel.G, bgPixel.B, bgPixel.A);

            // 7. Calculate scale and rasterize directly to ImageSharp
            double scale = CalculateScale(page, targetSize);
            if (scale <= 0) return null;

            // No ImageSharp manipulation happens here—it's exported perfectly from the vector engine!
            return page.SaveAsImage(scale);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Failed to create styled vector symbol for {SymbolKey}", symbolKey);
            Log.Information(svgContent);
            return null;
        }
    }


    // ═════════════════════════════════════════════════════════════════════
    //  Private Helpers
    // ═════════════════════════════════════════════════════════════════════

    
    
    public static string SetStyle(string xml, Dictionary<string, string> styleProperties)
    {
        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(xml);
            var main = doc.GetElementsByTagName("svg").Cast<XmlElement>().FirstOrDefault();
            //Get any <text> nodes
            var done = false;

            //check if main (<svg> node) has style attribute
            var style = main.GetAttribute("style");
            
            var existingProperties = GetStyleProperties(style);

            if (existingProperties.Count != 0)
            {
                //replace exsisting if they match
                foreach (var keyValuePair in styleProperties)
                {
                    existingProperties[keyValuePair.Key] = keyValuePair.Value;
                }
            }
            else
            {
                existingProperties = styleProperties;
            }
            
            //create new style string
            var styleString = existingProperties.Select(kv => $"{kv.Key}:{kv.Value}").Aggregate((a, b) => $"{a};{b}");
            
            //set the attribute
            
            main.SetAttribute("style", styleString);
            
            var result = doc.WriteSVGXML()!.TrimStart('\uFEFF');

            return result;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error removing changing style from");
            return xml;
        }
    }
    
    public static Dictionary<string, string> GetStyleProperties(string attributeString)
    {
        if (string.IsNullOrEmpty(attributeString))
        {
            return new Dictionary<string, string>();
        }
        
        //break down a string of svg style properties into a dictionary
        //e.g. "fill:#000000;stroke:none;stroke-width:1px" => { "fill": "#000000", "stroke": "none", "stroke-width": "1px" }
        var properties = new Dictionary<string, string>();
        var pairs = attributeString.ToLowerInvariant().Split(';', StringSplitOptions.RemoveEmptyEntries);

        var returnDict = new Dictionary<string, string>();
        
        foreach (var pair in pairs)
        {
            returnDict.Add(pair.Split(':')[0].Trim(), pair.Split(':')[1].Trim());
        }
        
        return returnDict;
    }
    
    /// <summary>
    /// Walks the resolution hierarchy to find a matching symbol key in the file index.
    /// Priority: prefix+tag → prefix+reversed → tag → reversed.
    /// </summary>
    private string? ResolveSymbolKey(string cleanTag, string reversedTag, string? manaPrefix)
    {
        if (!string.IsNullOrWhiteSpace(manaPrefix))
        {
            var prefix = manaPrefix.ToLowerInvariant();
            var prefixedTag = prefix + cleanTag;
            if (_symbolIndex.ContainsKey(prefixedTag))
                return prefixedTag;

            var prefixedReversed = prefix + reversedTag;
            if (_symbolIndex.ContainsKey(prefixedReversed))
                return prefixedReversed;
        }

        if (_symbolIndex.ContainsKey(cleanTag))
            return cleanTag;

        if (_symbolIndex.ContainsKey(reversedTag))
            return reversedTag;

        return null;
    }

    /// <summary>
    /// Gets a VectSharp.Page from Tier 1 cache, or loads and caches the SVG from disk.
    /// Thread-safe via per-key SemaphoreSlim.
    /// </summary>
    private Page? GetOrLoadPage(string symbolKey)
    {
        if (_vectorCache.TryGetValue(symbolKey, out var cached))
            return cached;

        if (!_symbolIndex.TryGetValue(symbolKey, out var filePath))
            return null;

        // Only SVG files are supported for vector caching
        if (!filePath.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
            return null;

        var vectorLock = _vectorLocks.GetOrAdd(symbolKey, _ => new SemaphoreSlim(1, 1));
        vectorLock.Wait();
        try
        {
            // Double-check after acquiring lock
            if (_vectorCache.TryGetValue(symbolKey, out cached))
                return cached;

            if (!File.Exists(filePath))
            {
                Log.Warning("Mana symbol SVG file disappeared: {Key} → {Path}", symbolKey, filePath);
                return null;
            }

            Page page;
            try
            {
                page = Parser.FromFile(filePath);
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Failed to parse mana symbol SVG: {Key} → {Path}", symbolKey, filePath);
                return null;
            }

            _vectorCache[symbolKey] = page;
            Log.Debug("Loaded mana symbol SVG into vector cache: {Key} ({W}x{H})", symbolKey, page.Width, page.Height);
            return page;
        }
        finally
        {
            vectorLock.Release();
        }
    }

    /// <summary>
    /// Calculates the VectSharp rasterization scale so the larger page dimension
    /// hits the requested targetSize in pixels.
    /// </summary>
    private static double CalculateScale(Page page, int targetSize)
    {
        if (page.Width <= 0 && page.Height <= 0)
            return 0;

        var maxDimension = Math.Max(page.Width, page.Height);
        return targetSize / maxDimension;
    }

    /// <summary>
    /// Recursively scans the mana symbols directory and builds a case-insensitive
    /// dictionary mapping symbol name (without extension) to absolute file path.
    /// Supports both SVG and PNG files. For subdirectories, the symbol name includes
    /// the directory prefix (e.g. "outline/outlinew" → key "outlinew").
    /// </summary>
    private static Dictionary<string, string> BuildSymbolIndex(string manaRoot)
    {
        var index = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (!Directory.Exists(manaRoot))
        {
            Log.Warning("Mana symbols directory not found: {Path}", manaRoot);
            return index;
        }

        var extensions = new[] {".svg", ".png"};

        foreach (var filePath in Directory.EnumerateFiles(manaRoot, "*.*", SearchOption.AllDirectories))
        {
            var ext = Path.GetExtension(filePath);
            if (!extensions.Any(e => e.Equals(ext, StringComparison.OrdinalIgnoreCase)))
                continue;

            var name = Path.GetFileNameWithoutExtension(filePath).ToLowerInvariant();

            // Prefer SVG over PNG if both exist for the same name
            if (index.TryGetValue(name, out var existing))
            {
                if (existing.EndsWith(".svg", StringComparison.OrdinalIgnoreCase))
                    continue; // Already have an SVG, keep it

                if (ext.Equals(".svg", StringComparison.OrdinalIgnoreCase))
                    index[name] = filePath; // Upgrade from PNG to SVG
            }
            else
            {
                index[name] = filePath;
            }
        }

        return index;
    }

    private static string Reverse(string input)
    {
        if (input.Length <= 1)
            return input;

        var chars = input.ToCharArray();
        Array.Reverse(chars);
        return new string(chars);
    }

    // ═════════════════════════════════════════════════════════════════════
    //  Disposal
    // ═════════════════════════════════════════════════════════════════════

    public void Dispose()
    {
        _frameGate.Dispose();

        foreach (var semaphore in _vectorLocks.Values)
            semaphore.Dispose();

        foreach (var semaphore in _rasterLocks.Values)
            semaphore.Dispose();

        // Tier 1 vector cache: VectSharp.Page does not implement IDisposable,
        // so just clear the references.
        _vectorCache.Clear();

        // Tier 2 raster cache entries are disposed via their eviction callbacks
        // when the IMemoryCache itself is disposed by the DI container.
    }
}