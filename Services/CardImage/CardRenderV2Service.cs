using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using CardConjurer.Models.Assets;
using CardConjurer.Models.CardImage;
using CardConjurer.Services.Assets;
using Microsoft.Extensions.Options;
using Serilog;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Processing.Processors.Transforms;

namespace CardConjurer.Services.CardImage;

public sealed class CardRenderV2Service : ICardRenderV2Service
{
    private const int DefaultWidth = 2010;
    private const int DefaultHeight = 2814;
    private const string DefaultTextFontFamily = "plantin-mt-pro-rg";

    private readonly IWebHostEnvironment _environment;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _uploadsRoot;
    private readonly string _publicUploadsBasePath;
    private readonly string _localArtRoot;

    private readonly FontCollection _fontCollection = new();
    private readonly Dictionary<string, FontFamily> _fontFamilies = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _fontLock = new();
    private bool _fontsLoaded;

    // Place this near the top of CardRenderV2Service, below the constants
    private static readonly Dictionary<string, (string FamilyName, FontStyle BaseStyle)> CssFontMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // The "Fixed" Families (Merged in FontForge)
        {"mplantin", ("MPlantin", FontStyle.Regular)},
        {"mplantini", ("MPlantin", FontStyle.Italic)},
        {"gothammedium", ("Gotham", FontStyle.Regular)},
        {"gothambold", ("Gotham", FontStyle.Bold)},
        {"decour", ("Decour Cnd Regular", FontStyle.Regular)},
        {"decouritalic", ("Decour Cnd Regular", FontStyle.Italic)},
        {"dinnext", ("DINNextW01", FontStyle.Regular)},
        {"dinnextbold", ("DINNextW01", FontStyle.Bold)},
        {"montserrat-medium", ("Montserrat", FontStyle.Regular)},
        {"montserrat-semibold", ("Montserrat", FontStyle.Bold)},

        // MTG Core Fonts
        {"belerenb", ("Beleren2016", FontStyle.Regular)}, // Metadata style is Regular even though visually bold
        {"belerenbsc", ("Beleren Small Caps", FontStyle.Bold)},
        {"matrix", ("Matrix", FontStyle.Regular)},
        {"matrixb", ("Matrix", FontStyle.Bold)},
        {"matrixbsc", ("MatrixBoldSmallCaps", FontStyle.Regular)},
        {"phyrexian", ("Phi_horizontal_gbrsh_9.6", FontStyle.Regular)}, // Modern Phyrexian (woff2)
        {"phyrexianold", ("Phyrexian", FontStyle.Regular)}, // Old Phyrexian (ttf)
        {"goudymedieval", ("MagicMedieval", FontStyle.Regular)},

        // Plantin Variants
        {"plantinsemibold", ("Plantin Semibold", FontStyle.Bold)},
        {"plantinsemibolditalic", ("Plantin Semibold", FontStyle.BoldItalic)},
        {"plantin-mt-pro-rg", ("Plantin MT Pro", FontStyle.Regular)},
        {"plantin-mt-pro-rg-it", ("Plantin MT Pro", FontStyle.Italic)},
        {"plantin-mt-pro-bold", ("Plantin MT Pro", FontStyle.Bold)},
        {"plantin-mt-pro-semibd-it", ("Plantin MT Pro Semibold", FontStyle.Italic)},

        // Gill Sans Family
        {"gillsans", ("Gill Sans", FontStyle.Regular)},
        {"gillsansitalic", ("Gill Sans", FontStyle.Italic)},
        {"gillsansbold", ("Gill Sans", FontStyle.Bold)},
        {"gillsansbolditalic", ("Gill Sans", FontStyle.BoldItalic)},

        // Neo Sans Family
        {"neosans", ("Neo Sans Pro", FontStyle.Regular)},
        {"neosansitalic", ("Neo Sans Pro", FontStyle.Italic)},

        // Specialty & Misc Fonts
        {"acme-regular", ("Acme", FontStyle.Regular)},
        {"pixelfont-regular", ("VT323", FontStyle.Regular)},
        {"fritz-quadrata", ("Fritz Quadrata Cyrillic", FontStyle.Regular)},
        {"japanese-title", ("NudMotoyaExAporo-W6-90msp-RKSJ-H", FontStyle.Regular)},
        {"japanese", ("DFMaruGothic Std W3", FontStyle.Regular)},
        {"invocation", ("Invocation and glyphs", FontStyle.Regular)},
        {"invocation-text", ("ShangoGothic-Bold", FontStyle.Bold)},
        {"souvenir", ("Souvenir Itc T OT", FontStyle.Bold)},
        {"souvenirmed", ("ITC Souvenir Std Medium", FontStyle.Regular)},
        {"palatino", ("Palatino", FontStyle.Regular)},
        {"amanda", ("Amanda Std", FontStyle.Regular)},
        {"specialelite", ("Special Elite", FontStyle.Regular)},
        {"ocra", ("OCR A Std", FontStyle.Regular)},
        {"officina", ("OfficinaSerITC", FontStyle.Regular)},
        {"davisonamericana", ("Davison Americana CG", FontStyle.Regular)},
        {"saloongirl", ("Saloon Girl", FontStyle.Regular)},
        {"arialblack", ("Arial Black", FontStyle.Regular)},
        {"dinnextmedium", ("DINNextW10-Medium", FontStyle.Regular)},
        {"notosans", ("Noto Sans", FontStyle.Regular)},
        {"magic-fomalhaut", ("Magic-Fomalhaut", FontStyle.Regular)},
        {"thunderman", ("Thunderman", FontStyle.Regular)}
    };

    public CardRenderV2Service(
        IWebHostEnvironment environment,
        IHttpClientFactory httpClientFactory,
        IOptions<AssetStorageOptions> assetStorageOptions)
    {
        _environment = environment;
        _httpClientFactory = httpClientFactory;

        var storage = assetStorageOptions.Value;
        _uploadsRoot = FileSystemAssetStorageService.ResolveUploadsRoot(storage.UploadsRoot, environment.ContentRootPath);
        _publicUploadsBasePath = FileSystemAssetStorageService.NormalizePublicBasePath(storage.PublicBasePath);
        _localArtRoot = Path.Combine(environment.ContentRootPath, "wwwroot", "local_art");
    }

    public async Task<Stream> RenderAsync(CardData card, bool preview, int? maxDimension, CancellationToken cancellationToken = default)
    {
        if (card.Width == null || card.Height == null)
        {
            Log.Error("Card dimensions not specified, using defaults.");
        }

        Log.Information("Rendering card. Width: {Width}, Height: {Height}, Preview: {Preview}, MaxDimension: {MaxDimension}", card.Width, card.Height, preview, maxDimension);

        var width = card.Width ?? DefaultWidth;
        var height = card.Height ?? DefaultHeight;
        var tempW = width;
        var tempH = height;
        if (card.Margins.HasValue && card.Margins.Value)
        {
            Log.Information("Applying margins. MarginX: {MarginX}, MarginY: {MarginY}", card.MarginX, card.MarginY);
            tempW = (int)Math.Round(width * (1 + 2 * (card.MarginX ?? 0)));
            tempH = (int)Math.Round(height * (1 + 2 * (card.MarginY ?? 0)));
            Log.Information("Rendering card. Width: {Width}, Height: {Height}", tempW, tempH);

        }

        using var canvas = new Image<Rgba32>(tempW, tempH);

        await DrawArtAsync(canvas, card, cancellationToken);
        await DrawFramesAsync(canvas, card, cancellationToken);
        DrawText(canvas, card);

        if (preview)
        {
            ResizePreview(canvas, maxDimension ?? 900);
        }

        /*
        if (card.Margins.HasValue && card.Margins.Value)
        {
            //Crop Canvas to card.width x card.height from center
            canvas.Mutate(ctx =>
            {
                var cropX = Math.Max(0, (canvas.Width - (card.Width ?? DefaultWidth)) / 2);
                var cropY = Math.Max(0, (canvas.Height - (card.Height ?? DefaultHeight)) / 2);
                var cropWidth = Math.Min(canvas.Width, card.Width ?? DefaultWidth);
                var cropHeight = Math.Min(canvas.Height, card.Height ?? DefaultHeight);

                ctx.Crop(new Rectangle(cropX, cropY, cropWidth, cropHeight));
            });
        }
        */

        var output = new MemoryStream();
        await canvas.SaveAsPngAsync(output, cancellationToken);
        output.Seek(0, SeekOrigin.Begin);

        // OPTIMIZATION: Good call keeping this. Releases pooled arrays back to the OS between generations.
        Configuration.Default.MemoryAllocator.ReleaseRetainedResources();
        return output;
    }

    private static int ClampDimension(int value) => Math.Clamp(value, 256, 8192);

    private async Task DrawArtAsync(Image<Rgba32> canvas, CardData card, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(card.ArtSource))
        {
            return;
        }

        using var art = await LoadImageAsync(card.ArtSource, cancellationToken);
        if (art is null)
        {
            return;
        }

        var marginX = card.MarginX ?? 0;
        var marginY = card.MarginY ?? 0;

        var x = ScaleX(card.ArtX ?? 0, canvas.Width, marginX);
        var y = ScaleY(card.ArtY ?? 0, canvas.Height, marginX);

        var zoom = card.ArtZoom ?? 1;
        if (zoom <= 0)
        {
            zoom = 1;
        }

        var targetWidth = Math.Max(1, (int)Math.Round(art.Width * zoom));
        var targetHeight = Math.Max(1, (int)Math.Round(art.Height * zoom));

        // OPTIMIZATION: Changed downscale to Bicubic to prevent over-sharpening natural artwork brush strokes. Spline kept for upscale.
        IResampler resampler = zoom < 1 ? KnownResamplers.Bicubic : KnownResamplers.Spline;

        using var prepared = art.Clone(ctx => ctx.Resize(targetWidth, targetHeight, resampler));

        var rotate = (float)(card.ArtRotate ?? 0);
        if (Math.Abs(rotate) > 0.001f)
        {
            prepared.Mutate(ctx => ctx.Rotate(rotate));
        }

        canvas.Mutate(ctx => ctx.DrawImage(prepared, new Point(x, y), 1f));
    }

    private async Task DrawFramesAsync(Image<Rgba32> canvas, CardData card, CancellationToken cancellationToken)
    {
        if (card.Frames is null || card.Frames.Count == 0)
        {
            return;
        }

        var marginX = 0;//card.MarginX ?? 0;
        var marginY = 0;//card.MarginY ?? 0;

        foreach (var frame in card.Frames.AsEnumerable().Reverse())
        {
            if (frame is null || string.IsNullOrWhiteSpace(frame.Src))
            {
                continue;
            }

            using var sourceFrame = await LoadImageAsync(frame.Src, cancellationToken);
            if (sourceFrame is null)
            {
                continue;
            }

            var bounds = frame.Bounds;
            var x = ScaleX(bounds?.X ?? 0, canvas.Width, marginX);
            var y = ScaleY(bounds?.Y ?? 0, canvas.Height, marginY);
            var width = ScaleWidth(bounds?.Width ?? 1, canvas.Width);
            var height = ScaleHeight(bounds?.Height ?? 1, canvas.Height);

            if (width <= 0 || height <= 0)
            {
                continue;
            }

            // OPTIMIZATION: Structural resamplers - CatmullRom for sharp upscaling, Lanczos3 for sharp downscaling
            IResampler resampler = (sourceFrame.Width < width) ? KnownResamplers.CatmullRom : KnownResamplers.Lanczos3;

            // OPTIMIZATION: Eliminated full-canvas 'layer'. Working directly on the sized image chunk.
            using var sizedFrame = sourceFrame.Clone(ctx => ctx.Resize(width, height, resampler));

            if (frame.Masks is {Count: > 0})
            {
                // OPTIMIZATION: Mask canvas only needs to be the size of the frame, not the whole card.
                using var combinedMask = new Image<Rgba32>(width, height);
                foreach (var mask in frame.Masks)
                {
                    if (mask is null || string.IsNullOrWhiteSpace(mask.Src))
                    {
                        continue;
                    }

                    using var sourceMask = await LoadImageAsync(mask.Src, cancellationToken);
                    if (sourceMask is null)
                    {
                        continue;
                    }

                    // OPTIMIZATION: Reduced from Lanczos8 to Lanczos3 for massive performance gain and less ringing.
                    using var sizedMask = sourceMask.Clone(ctx => ctx.Resize(width, height, KnownResamplers.Lanczos3));
                    combinedMask.Mutate(ctx => ctx.DrawImage(sizedMask, new Point(0, 0), 1f));
                }

                ApplyMaskAlpha(sizedFrame, combinedMask);
            }

            // OPTIMIZATION: Overlays and adjustments now process a fraction of the pixels (only the frame bounds)
            if (frame.ColorOverlayCheck == true && !string.IsNullOrWhiteSpace(frame.ColorOverlay))
            {
                ApplyColorOverlay(sizedFrame, ParseColor(frame.ColorOverlay, Color.Transparent));
            }

            if ((frame.HslHue ?? 0) != 0 || (frame.HslSaturation ?? 0) != 0 || (frame.HslLightness ?? 0) != 0)
            {
                ApplyHslAdjustments(sizedFrame, frame.HslHue ?? 0, frame.HslSaturation ?? 0, frame.HslLightness ?? 0);
            }

            var opacity = (float)Math.Clamp((frame.Opacity ?? 100) / 100d, 0d, 1d);

            // OPTIMIZATION: Passed x and y offsets to the custom blend modes since sizedFrame is no longer full-canvas
            if (frame.Erase == true)
            {
                ApplyErase(canvas, sizedFrame, opacity, x, y);
                continue;
            }

            if (frame.PreserveAlpha == true)
            {
                ApplyPreserveAlphaBlend(canvas, sizedFrame, opacity, x, y);
                continue;
            }

            // Standard draw with offset
            canvas.Mutate(ctx => ctx.DrawImage(sizedFrame, new Point(x, y), opacity));
        }
    }

    private static HorizontalAlignment ResolveAlignment(string? value)
    {
        return value?.ToLowerInvariant() switch
        {
            "center" => HorizontalAlignment.Center,
            "right" => HorizontalAlignment.Right,
            _ => HorizontalAlignment.Left
        };
    }

    private static float ResolveFontSize(CardTextObject text, int cardWidth)
    {
        if (text.Size is > 0)
        {
            return (float)Math.Clamp(Math.Ceiling((float)(text.Size.Value * cardWidth)), 8f, 220f);
        }

        if (text.FontSize is > 0)
        {
            return Math.Clamp((float)text.FontSize.Value, 8f, 220f);
        }

        return 28f;
    }

    private void EnsureFontsLoaded()
    {
        if (_fontsLoaded)
        {
            return;
        }

        lock (_fontLock)
        {
            if (_fontsLoaded)
            {
                return;
            }

            var roots = new[]
            {
                //Path.Combine(_environment.ContentRootPath, "fonts"),
                Path.Combine(_environment.WebRootPath ?? string.Empty, "fonts")
            }.Where(Directory.Exists);

            foreach (var root in roots)
            {
                foreach (var file in Directory.EnumerateFiles(root, "*.*", SearchOption.TopDirectoryOnly)
                             .Where(f => f.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)
                                         || f.EndsWith(".otf", StringComparison.OrdinalIgnoreCase)
                                         || f.EndsWith(".ttc", StringComparison.OrdinalIgnoreCase)))
                {
                    try
                    {
                        Log.Information("Loading font from file: {File}", file);
                        var family = _fontCollection.Add(file);
                        var alias = Path.GetFileNameWithoutExtension(file);
                        if (!string.IsNullOrWhiteSpace(alias) && !_fontFamilies.ContainsKey(alias))
                        {
                            _fontFamilies[alias] = family;
                        }

                        var strippedAlias = StripFontAlias(alias ?? string.Empty);
                        if (!string.IsNullOrWhiteSpace(strippedAlias) && !_fontFamilies.ContainsKey(strippedAlias))
                        {
                            _fontFamilies[strippedAlias] = family;
                        }

                        if (!_fontFamilies.ContainsKey(family.Name))
                        {
                            _fontFamilies[family.Name] = family;
                        }
                    }
                    catch
                    {
                        Log.Error("Failed to load font from file: {File}", file);
                    }
                }
            }

            _fontsLoaded = true;
        }
    }

    private Font ResolveFont(string requestedCssName, float size, bool isBold = false, bool isItalic = false)
    {
        // Default fallback values
        string targetFamilyName = "MPlantin";
        FontStyle targetStyle = FontStyle.Regular;

        // 1. Look up the exact CSS string requested by Card Conjurer
        if (!string.IsNullOrWhiteSpace(requestedCssName) && CssFontMap.TryGetValue(requestedCssName.Trim(), out var mapped))
        {
            targetFamilyName = mapped.FamilyName;
            targetStyle = mapped.BaseStyle;
        }
        else
        {
            Log.Warning("CSS Font alias '{Requested}' not found in map, falling back to {Fallback}.", requestedCssName, targetFamilyName);
        }

        // 2. Combine the base font style with any active MTG Tags (like {i} or {bold})
        if (isBold) targetStyle |= FontStyle.Bold;
        if (isItalic) targetStyle |= FontStyle.Italic;

        // 3. Fetch the specific Family from ImageSharp
        if (_fontCollection.TryGet(targetFamilyName, out FontFamily family))
        {
            try
            {
                return family.CreateFont(size, targetStyle);
            }
            catch (FontFamilyNotFoundException)
            {
                // If the user requested an Italic style via a tag but the font doesn't have an italic variant,
                // fallback to the regular version of that specific font to prevent a crash.
                Log.Warning("Style '{Style}' not found in family '{Family}'. Falling back to Regular.", targetStyle, targetFamilyName);
                return family.CreateFont(size, FontStyle.Regular);
            }
        }

        // Ultimate fallback if the font file is completely missing from the server
        Log.Error("Font family '{Family}' could not be found in the FontCollection!", targetFamilyName);
        return SystemFonts.Get("Arial").CreateFont(size, FontStyle.Regular);
    }

    private static string StripFontAlias(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var buf = new char[name.Length];
        var len = 0;
        foreach (var c in name)
        {
            if (c != '-' && c != '_' && c != ' ')
                buf[len++] = c;
        }

        return new string(buf, 0, len);
    }


    private static int ScaleX(double input, int cardWidth, double marginX)
    {
        return (int)Math.Round((input + marginX) * cardWidth);
    }

    private static int ScaleY(double input, int cardHeight, double marginY)
    {
        return (int)Math.Round((input + marginY) * cardHeight);
    }

    private static int ScaleWidth(double input, int cardWidth)
    {
        return Math.Max(1, (int)Math.Round(input * cardWidth));
    }

    private static int ScaleHeight(double input, int cardHeight)
    {
        return Math.Max(1, (int)Math.Round(input * cardHeight));
    }

    private static void ApplyMaskAlpha(Image<Rgba32> layer, Image<Rgba32> mask)
    {
        layer.ProcessPixelRows(mask, (layerRows, maskRows) =>
        {
            for (var y = 0; y < layerRows.Height; y++)
            {
                var layerRow = layerRows.GetRowSpan(y);
                var maskRow = maskRows.GetRowSpan(y);

                for (var x = 0; x < layerRow.Length; x++)
                {
                    var alpha = (layerRow[x].A * maskRow[x].A) / 255;
                    layerRow[x].A = (byte)alpha;
                }
            }
        });
    }

    private static void ApplyColorOverlay(Image<Rgba32> layer, Color overlay)
    {
        var overlayPixel = overlay.ToPixel<Rgba32>();

        layer.ProcessPixelRows(rows =>
        {
            for (var y = 0; y < rows.Height; y++)
            {
                var row = rows.GetRowSpan(y);
                for (var x = 0; x < row.Length; x++)
                {
                    if (row[x].A == 0)
                    {
                        continue;
                    }

                    row[x].R = overlayPixel.R;
                    row[x].G = overlayPixel.G;
                    row[x].B = overlayPixel.B;
                }
            }
        });
    }

    private static void ApplyHslAdjustments(Image<Rgba32> layer, double hue, double saturation, double lightness)
    {
        layer.Mutate(ctx =>
        {
            if (Math.Abs(hue) > 0.001)
            {
                ctx.Hue((float)hue);
            }

            if (Math.Abs(saturation) > 0.001)
            {
                var saturateValue = Math.Clamp(1f + (float)(saturation / 100d), 0f, 3f);
                ctx.Saturate(saturateValue);
            }

            if (Math.Abs(lightness) > 0.001)
            {
                var brightness = Math.Clamp(1f + (float)(lightness / 100d), 0f, 3f);
                ctx.Brightness(brightness);
            }
        });
    }

    // OPTIMIZATION: Added offsetX and offsetY parameters, and bound checking, to correctly map the smaller cropped layer onto the main canvas.
    private static void ApplyErase(Image<Rgba32> canvas, Image<Rgba32> layer, float opacity, int offsetX, int offsetY)
    {
        canvas.ProcessPixelRows(layer, (canvasRows, layerRows) =>
        {
            for (var y = 0; y < layerRows.Height; y++)
            {
                var canvasY = y + offsetY;
                // Prevent out of bounds if the layer sits partially off the main canvas
                if (canvasY < 0 || canvasY >= canvasRows.Height) continue;

                var canvasRow = canvasRows.GetRowSpan(canvasY);
                var layerRow = layerRows.GetRowSpan(y);

                for (var x = 0; x < layerRow.Length; x++)
                {
                    var canvasX = x + offsetX;
                    if (canvasX < 0 || canvasX >= canvasRow.Length) continue;

                    if (layerRow[x].A == 0) continue;

                    var eraseAlpha = (byte)Math.Clamp(layerRow[x].A * opacity, 0, 255);
                    canvasRow[canvasX].A = (byte)Math.Clamp(canvasRow[canvasX].A - eraseAlpha, 0, 255);
                }
            }
        });
    }

    // OPTIMIZATION: Added offsetX and offsetY parameters, and bound checking, to correctly map the smaller cropped layer onto the main canvas.
    private static void ApplyPreserveAlphaBlend(Image<Rgba32> canvas, Image<Rgba32> layer, float opacity, int offsetX, int offsetY)
    {
        canvas.ProcessPixelRows(layer, (canvasRows, layerRows) =>
        {
            for (var y = 0; y < layerRows.Height; y++)
            {
                var canvasY = y + offsetY;
                if (canvasY < 0 || canvasY >= canvasRows.Height) continue;

                var canvasRow = canvasRows.GetRowSpan(canvasY);
                var layerRow = layerRows.GetRowSpan(y);

                for (var x = 0; x < layerRow.Length; x++)
                {
                    var canvasX = x + offsetX;
                    if (canvasX < 0 || canvasX >= canvasRow.Length) continue;

                    if (layerRow[x].A == 0) continue;

                    var blend = (layerRow[x].A / 255f) * opacity;
                    canvasRow[canvasX].R = (byte)Math.Clamp(canvasRow[canvasX].R * (1 - blend) + layerRow[x].R * blend, 0, 255);
                    canvasRow[canvasX].G = (byte)Math.Clamp(canvasRow[canvasX].G * (1 - blend) + layerRow[x].G * blend, 0, 255);
                    canvasRow[canvasX].B = (byte)Math.Clamp(canvasRow[canvasX].B * (1 - blend) + layerRow[x].B * blend, 0, 255);
                }
            }
        });
    }

    private static void ResizePreview(Image<Rgba32> canvas, int maxDimension)
    {
        maxDimension = Math.Clamp(maxDimension, 256, 2048);

        var scale = Math.Min((double)maxDimension / canvas.Width, (double)maxDimension / canvas.Height);
        if (scale >= 1)
        {
            return;
        }

        var width = Math.Max(1, (int)Math.Round(canvas.Width * scale));
        var height = Math.Max(1, (int)Math.Round(canvas.Height * scale));

        // OPTIMIZATION: Reduced from Lanczos8 to Lanczos3 for faster preview generation with less ringing.
        canvas.Mutate(ctx => ctx.Resize(width, height, KnownResamplers.Lanczos3));
    }

    private static Color ParseColor(string? value, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            Log.Debug("Color not specified, using fallback.");
            return fallback;
        }

        var input = value.Trim();

        try
        {
            if (input.StartsWith('#'))
            {
                return Color.ParseHex(input);
            }

            if (input.StartsWith("rgb", StringComparison.OrdinalIgnoreCase))
            {
                var leftParen = input.IndexOf('(');
                var rightParen = input.LastIndexOf(')');
                if (leftParen < 0 || rightParen <= leftParen)
                {
                    return fallback;
                }

                var inner = input[(leftParen + 1)..rightParen];
                var parts = inner.Split(',').Select(p => p.Trim()).ToArray();
                if (parts.Length >= 3 &&
                    byte.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var r) &&
                    byte.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var g) &&
                    byte.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var b))
                {
                    return Color.FromRgb(r, g, b);
                }
            }

            return input.ToLowerInvariant() switch
            {
                "black" => Color.Black,
                "white" => Color.White,
                "red" => Color.Red,
                "green" => Color.Green,
                "blue" => Color.Blue,
                "yellow" => Color.Yellow,
                "gray" => Color.Gray,
                "grey" => Color.Gray,
                _ => fallback
            };
        }
        catch
        {
            Log.Error("Failed to parse color value: {Value}, using fallback.", value);
            return fallback;
        }
    }

    private async Task<Image<Rgba32>?> LoadImageAsync(string source, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return null;
        }

        if (source.StartsWith("data:image", StringComparison.OrdinalIgnoreCase))
        {
            var comma = source.IndexOf(',');
            if (comma < 0)
            {
                return null;
            }

            try
            {
                var payload = source[(comma + 1)..];
                var data = Convert.FromBase64String(payload);
                await using var stream = new MemoryStream(data);
                return await Image.LoadAsync<Rgba32>(stream, cancellationToken);
            }
            catch
            {
                return null;
            }
        }

        if (Uri.TryCreate(source, UriKind.Absolute, out var absoluteUri)
            && (absoluteUri.Scheme == Uri.UriSchemeHttp || absoluteUri.Scheme == Uri.UriSchemeHttps))
        {
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(12);
            httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("CardConjurer", "1.0"));

            try
            {
                await using var stream = await httpClient.GetStreamAsync(absoluteUri, cancellationToken);
                return await Image.LoadAsync<Rgba32>(stream, cancellationToken);
            }
            catch
            {
                return null;
            }
        }

        var localPath = ResolveLocalPath(source);
        if (localPath is null || !File.Exists(localPath))
        {
            return null;
        }

        await using var fileStream = File.OpenRead(localPath);
        return await Image.LoadAsync<Rgba32>(fileStream, cancellationToken);
    }

    private string? ResolveLocalPath(string source)
    {
        var normalized = source.Trim();

        if (normalized.StartsWith("/"))
        {
            if (normalized.StartsWith(_publicUploadsBasePath + "/", StringComparison.OrdinalIgnoreCase))
            {
                var relative = normalized[_publicUploadsBasePath.Length..].TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                return EnsureInsideRoot(_uploadsRoot, relative);
            }

            if (normalized.StartsWith("/img/", StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith("/js/", StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith("/css/", StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith("/local_art/", StringComparison.OrdinalIgnoreCase))
            {
                var relative = normalized.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                return EnsureInsideRoot(_environment.WebRootPath ?? string.Empty, relative);
            }
        }

        if (!normalized.Contains('/') && !normalized.Contains('\\'))
        {
            return EnsureInsideRoot(_localArtRoot, normalized);
        }

        return null;
    }

    private static string? EnsureInsideRoot(string root, string relative)
    {
        if (string.IsNullOrWhiteSpace(root))
        {
            return null;
        }

        var fullRoot = Path.GetFullPath(root);
        var fullPath = Path.GetFullPath(Path.Combine(fullRoot, relative));

        return fullPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase) ? fullPath : null;
    }


    public class TextRenderState
    {
        public float FontSize { get; set; }
        public string FontFamily { get; set; } = DefaultTextFontFamily;
        public Color Color { get; set; } = Color.Black;
        public bool IsItalic { get; set; }
        public bool IsBold { get; set; }
        public float CurrentX { get; set; }
        public float CurrentY { get; set; }
        public float IndentX { get; set; }

        // NEW: Holds the 35% extra gap until the line wraps
        public float AddLineSpacing { get; set; }

        public Font GetCurrentFont(CardRenderV2Service service)
        {
            //Log.Information("Resolving font. Family: {Family}, Size: {Size}, Bold: {Bold}, Italic: {Italic}", FontFamily, FontSize, IsBold, IsItalic);
            return service.ResolveFont(FontFamily, FontSize, IsBold, IsItalic);
        }
    }


// Helper to handle horizontal alignment when stamping the line
    private void CompositeLine(Image<Rgba32> textLayer, Image<Rgba32> lineLayer, float destY, float lineWidth, int maxWidth, HorizontalAlignment align)
    {
        float destX = 0;
        if (align == HorizontalAlignment.Center) destX = (maxWidth - lineWidth) / 2f;
        if (align == HorizontalAlignment.Right) destX = maxWidth - lineWidth;

        // The text on lineLayer is offset by 'padding', so it perfectly drops onto textLayer with safety margins intact!
        textLayer.Mutate(ctx => ctx.DrawImage(lineLayer, new Point((int)destX, (int)destY), 1f));
    }

    private void ProcessTag(Tokenizer.TagToken tag, TextRenderState state)
    {
        switch (tag.Code)
        {
            // Font Styles
            case "i": state.IsItalic = true; break;
            case "/i": state.IsItalic = false; break;
            case "bold": state.IsBold = true; break;
            case "/bold": state.IsBold = false; break;

            // NEW: Indentation
            case "indent": state.IndentX = state.CurrentX; break;
            case "/indent": state.IndentX = 0; break;
            case "fixtextalign": state.AddLineSpacing = state.FontSize * 0.35f; break; // Immediate fix for tags that mess with alignment like {bar}

            // Line Breaks
// Inside ProcessTag()...
            case "line":
                state.CurrentX = 99999;
                state.AddLineSpacing = state.FontSize * 0.35f; // Store it for the wrap!
                break;
            case "lns":
            case "linenospace":
                state.CurrentX = 99999;
                state.IndentX = 0;
                break;

            // Fonts and Colors
            case var c when c.StartsWith("fontcolor"):
                state.Color = ParseColor(c.Replace("fontcolor", ""), Color.Black);
                break;
            case var c when c.StartsWith("fontsize"):
                state.FontSize = int.TryParse(c.Replace("fontsize#", "").Trim(), out var size) ? state.FontSize + size : state.FontSize;
                break;
            case var f when f.StartsWith("font"):
                state.FontFamily = f.Replace("font", "");
                break;
        }
    }

    private (float Width, float Height) MeasureAndDrawTokens(Image<Rgba32>? textLayer,
        List<Tokenizer.TextToken> tokens,
        float fontSize,
        int maxWidth,
        HorizontalAlignment alignment,
        bool measureOnly,
        CardTextObject textBlock,
        CardData card,
        int padding = 0) // <--- NEW: Padding parameter
    {
        var state = new TextRenderState
        {
            FontSize = fontSize,
            FontFamily = !string.IsNullOrWhiteSpace(textBlock.Font) ? textBlock.Font : DefaultTextFontFamily,
            Color = ParseColor(textBlock.Color, Color.Black)
        };

        float maxLineHeight = (fontSize);

        Log.Information(textBlock.Name);
        if (textBlock.Name.Equals("Rules Text", StringComparison.OrdinalIgnoreCase))
        {
            var startingSize = Math.Ceiling((double)(textBlock.Size * card.Height));
            Log.Information("Rules Text block detected. Starting font size based on card height: {StartingSize} Current {FontSide}",startingSize, fontSize);
            if (fontSize < startingSize)
            {
                maxLineHeight =(float)Math.Ceiling( fontSize * 0.7f);
                Log.Information("Applying 80% line height reduction for Rules Text to prevent excessive gaps. Starting font size: {StartingSize}, Applied line height: {LineHeight}", startingSize, maxLineHeight);
                
            }
        }
        state.AddLineSpacing = maxLineHeight * 0.35f; // Start with 35% extra spacing for tags that affect alignment like {bar}

        float widestLineWidth = 0;

        Image<Rgba32>? lineLayer = null;
        if (!measureOnly && textLayer != null)
        {
            // Add padding so ascenders/shadows don't clip horizontally or vertically
            lineLayer = new Image<Rgba32>(maxWidth + (padding * 2), (int)(fontSize * 3) + padding);
        }

        try
        {
            foreach (var token in tokens)
            {
                switch (token)
                {
                    case Tokenizer.TagToken tag:
                        if (tag.Code == "bar")
                        {
                            if (state.CurrentX >= maxWidth)
                            {
                                widestLineWidth = Math.Max(widestLineWidth, state.CurrentX >= 99999 ? 0 : state.CurrentX);

                                if (!measureOnly && lineLayer != null && textLayer != null)
                                {
                                    CompositeLine(textLayer, lineLayer, state.CurrentY, state.CurrentX >= 99999 ? 0 : state.CurrentX, maxWidth, alignment);
                                    lineLayer.Mutate(ctx => ctx.Clear(Color.Transparent));
                                }

                                state.CurrentX = 0;
                                state.CurrentY += maxLineHeight;
                                
                            }

                            float barWidth = maxWidth * 0.93f;
                            float barHeight = fontSize * 0.5f;

                            if (!measureOnly && lineLayer != null)
                            {
                                // Shift the bar down/right by the padding amount
                                var barRect = new RectangleF(padding + (maxWidth - barWidth) / 2f, padding + barHeight / 2f, barWidth, ScaleHeight(0.002, card.Height ?? DefaultHeight));

                                var colors = new ColorStop[]
                                {
                                    new ColorStop(0f, Color.Transparent),
                                    new ColorStop(0.15f, Color.ParseHex("#606060")),
                                    new ColorStop(0.85f, Color.ParseHex("#606060")),
                                    new ColorStop(1f, Color.Transparent)
                                };

                                var brush = new LinearGradientBrush(new PointF(barRect.Left, 0), new PointF(barRect.Right, 0), GradientRepetitionMode.None, colors);
                                lineLayer.Mutate(ctx => ctx.Fill(brush, barRect));
                            }

                            state.CurrentX = 99999;
                            maxLineHeight = barHeight;
                            state.AddLineSpacing += maxLineHeight;
                        }
                        else
                        {
                            ProcessTag(tag, state);
                        }

                        break;

                    case Tokenizer.SpaceToken:
                        var spaceFont = state.GetCurrentFont(this);
                        var spaceWidth = TextMeasurer.MeasureSize(" ", new RichTextOptions(spaceFont)).Width;
                        state.CurrentX += spaceWidth;
                        break;

                    case Tokenizer.WordToken word:
                        var currentFont = state.GetCurrentFont(this);

                        // CRITICAL FIX: Push the draw origin down and right by 'padding' so nothing clips!
                        var options = new RichTextOptions(currentFont) {Origin = new PointF(state.CurrentX + padding, padding)};

                        // Keep measuring from 0,0 though, we only care about pure width/height here
                        var measureOptions = new RichTextOptions(currentFont) {Origin = new PointF(0, 0)};
                        var wordSize = TextMeasurer.MeasureSize(word.Text, measureOptions);

                        if (state.CurrentX + wordSize.Width > maxWidth && state.CurrentX > 0)
                        {
                            widestLineWidth = Math.Max(widestLineWidth, state.CurrentX >= 99999 ? 0 : state.CurrentX);

                            if (!measureOnly && lineLayer != null && textLayer != null)
                            {
                                CompositeLine(textLayer, lineLayer, state.CurrentY, state.CurrentX >= 99999 ? 0 : state.CurrentX, maxWidth, alignment);
                                lineLayer.Mutate(ctx => ctx.Clear(Color.Transparent));
                            }

                            state.CurrentX = state.IndentX;
                            state.CurrentY += maxLineHeight;
                            maxLineHeight = state.FontSize;
                            
                            state.CurrentY += state.AddLineSpacing; // Add any extra spacing from tags like {bar}
                            state.AddLineSpacing = 0; // Reset it for the next line

                            // Update origin for the wrap
                            options.Origin = new PointF(state.CurrentX + padding, padding);
                        }

                        if (!measureOnly && lineLayer != null)
                        {
                            lineLayer.Mutate(ctx => ctx.DrawText(options, word.Text, state.Color));
                        }

                        state.CurrentX += wordSize.Width;
                        break;
                }
            }

            if (state.CurrentX > 0)
            {
                float finalWidth = state.CurrentX >= 99999 ? 0 : state.CurrentX;
                widestLineWidth = Math.Max(widestLineWidth, finalWidth);

                if (!measureOnly && lineLayer != null && textLayer != null)
                {
                    CompositeLine(textLayer, lineLayer, state.CurrentY, finalWidth, maxWidth, alignment);
                }

                state.CurrentY += maxLineHeight;
            }


            return (widestLineWidth, state.CurrentY );
        }
        finally
        {
            lineLayer?.Dispose();
        }
    }

    private void DrawText(Image<Rgba32> canvas, CardData card)
    {
        if (card.Text is null || card.Text.Count == 0) return;
        EnsureFontsLoaded();

        foreach ((var name, var textBlock) in card.Text)
        {
            if (textBlock is null || string.IsNullOrWhiteSpace(textBlock.Text)) continue;

            var tokens = Tokenizer.TokenizeText(textBlock.Text, card);
            if (tokens.Count == 0) continue;

            var width = ScaleWidth(textBlock.Width ?? 1, canvas.Width);
            var height = ScaleHeight(textBlock.Height ?? 1, canvas.Height);
            if (width <= 1 || height <= 1) continue;

            var x = ScaleX(textBlock.X ?? 0, canvas.Width,  0);
            var y = ScaleY(textBlock.Y ?? 0, canvas.Height,  0);

            float startingFontSize = ResolveFontSize(textBlock, card.Height.Value);

            var alignment = ResolveAlignment(textBlock.Align);
            bool isOneLine = textBlock.OneLine == true;
            bool isBounded = textBlock.Bounded ?? true;

            float currentFontSize = startingFontSize;
            float measuredHeight = 0;
            float measuredWidth = 0;

            // --- THE AUTO-SHRINK LOOP ---
            while (currentFontSize > 1f)
            {
                var bounds = MeasureAndDrawTokens(null, tokens, currentFontSize, width, alignment, true, textBlock, card);
                measuredWidth = bounds.Width;
                measuredHeight = bounds.Height;

                if (isOneLine && measuredWidth > width)
                {
                    currentFontSize -= 1f;
                    continue;
                }

                if (!isOneLine && isBounded && measuredHeight > height)
                {
                    currentFontSize -= 1f;
                    continue;
                }

                break;
            }

            // --- FINAL RENDER WITH PADDING HACK ---
            int padding = (int)(currentFontSize * 0.5f); // Generous padding to protect ascenders

            // Make the image larger to hold the padding
            using var textLayer = new Image<Rgba32>(width + (padding * 2), height + (padding * 2));
            MeasureAndDrawTokens(textLayer, tokens, currentFontSize, width, alignment, false, textBlock, card, padding);

            // --- VERTICAL CENTERING ---
            float verticalAdjust = 0f;
            if (textBlock.NoVerticalCenter != true)
            {
                // Reverted to 0.15f, and removed Math.Max(0, ...) so the P/T box can slide UP if needed
                var f = 0.15f;

                if (name == "rules")
                {
                    f = 0.35f;
                }
                
                verticalAdjust = (height - measuredHeight + (currentFontSize * f)) / 2f;
            }

            // Draw onto the card, shifting left and up to compensate for our protective padding!
            canvas.Mutate(ctx => ctx.DrawImage(textLayer, new Point(x - padding, y - padding + (int)verticalAdjust), 1f));
        }
    }
}