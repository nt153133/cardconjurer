using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using CardConjurer.Models.Assets;
using CardConjurer.Models.CardImage;
using CardConjurer.Services.Assets;
using Microsoft.Extensions.Options;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CardConjurer.Services.CardImage;

public sealed class CardRenderV2Service : ICardRenderV2Service
{
    private const int DefaultWidth = 2010;
    private const int DefaultHeight = 2814;

    private readonly IWebHostEnvironment _environment;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _uploadsRoot;
    private readonly string _publicUploadsBasePath;
    private readonly string _localArtRoot;

    private readonly FontCollection _fontCollection = new();
    private readonly Dictionary<string, FontFamily> _fontFamilies = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _fontLock = new();
    private bool _fontsLoaded;

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
        var width = ClampDimension(card.Width ?? DefaultWidth);
        var height = ClampDimension(card.Height ?? DefaultHeight);

        using var canvas = new Image<Rgba32>(width, height);

        await DrawArtAsync(canvas, card, cancellationToken);
        await DrawFramesAsync(canvas, card, cancellationToken);
        DrawText(canvas, card);

        if (preview)
        {
            ResizePreview(canvas, maxDimension ?? 900);
        }

        var output = new MemoryStream();
        await canvas.SaveAsPngAsync(output, cancellationToken);
        output.Seek(0, SeekOrigin.Begin);
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
        var y = ScaleY(card.ArtY ?? 0, canvas.Height, marginY);

        var zoom = card.ArtZoom ?? 1;
        if (zoom <= 0)
        {
            zoom = 1;
        }

        var targetWidth = Math.Max(1, (int)Math.Round(art.Width * zoom));
        var targetHeight = Math.Max(1, (int)Math.Round(art.Height * zoom));

        using var prepared = art.Clone(ctx => ctx.Resize(targetWidth, targetHeight));

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

        var marginX = card.MarginX ?? 0;
        var marginY = card.MarginY ?? 0;

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

            using var layer = new Image<Rgba32>(canvas.Width, canvas.Height);
            using var sizedFrame = sourceFrame.Clone(ctx => ctx.Resize(width, height));
            layer.Mutate(ctx => ctx.DrawImage(sizedFrame, new Point(x, y), 1f));

            if (frame.Masks is { Count: > 0 })
            {
                using var maskLayer = new Image<Rgba32>(canvas.Width, canvas.Height);
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

                    using var sizedMask = sourceMask.Clone(ctx => ctx.Resize(width, height));
                    maskLayer.Mutate(ctx => ctx.DrawImage(sizedMask, new Point(x, y), 1f));
                }

                ApplyMaskAlpha(layer, maskLayer);
            }

            if (frame.ColorOverlayCheck == true && !string.IsNullOrWhiteSpace(frame.ColorOverlay))
            {
                ApplyColorOverlay(layer, ParseColor(frame.ColorOverlay, Color.Transparent));
            }

            if ((frame.HslHue ?? 0) != 0 || (frame.HslSaturation ?? 0) != 0 || (frame.HslLightness ?? 0) != 0)
            {
                ApplyHslAdjustments(layer, frame.HslHue ?? 0, frame.HslSaturation ?? 0, frame.HslLightness ?? 0);
            }

            var opacity = (float)Math.Clamp((frame.Opacity ?? 100) / 100d, 0d, 1d);

            if (frame.Erase == true)
            {
                ApplyErase(canvas, layer, opacity);
                continue;
            }

            if (frame.PreserveAlpha == true)
            {
                ApplyPreserveAlphaBlend(canvas, layer, opacity);
                continue;
            }

            canvas.Mutate(ctx => ctx.DrawImage(layer, opacity));
        }
    }

    private void DrawText(Image<Rgba32> canvas, CardData card)
    {
        if (card.Text is null || card.Text.Count == 0)
        {
            return;
        }

        EnsureFontsLoaded();

        foreach (var textBlock in card.Text.Values)
        {
            if (textBlock is null || string.IsNullOrWhiteSpace(textBlock.Text))
            {
                continue;
            }

            var text = NormalizeText(textBlock.Text);
            if (string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            var width = ScaleWidth(textBlock.Width ?? 1, canvas.Width);
            var height = ScaleHeight(textBlock.Height ?? 1, canvas.Height);
            if (width <= 1 || height <= 1)
            {
                continue;
            }

            var x = ScaleX(textBlock.X ?? 0, canvas.Width, card.MarginX ?? 0);
            var y = ScaleY(textBlock.Y ?? 0, canvas.Height, card.MarginY ?? 0);

            var fontSize = ResolveFontSize(textBlock, canvas.Width);
            var font = ResolveFont(textBlock.Font, fontSize, textBlock.FontStyle);
            var color = ParseColor(textBlock.Color, Color.White);

            using var textLayer = new Image<Rgba32>(width, height);
            var alignment = ResolveAlignment(textBlock.Align);

            var options = new RichTextOptions(font)
            {
                Origin = new PointF(0, 0),
                WrappingLength = width,
                HorizontalAlignment = alignment,
                VerticalAlignment = VerticalAlignment.Top
            };

            var finalText = textBlock.OneLine == true ? text.Replace("\n", " ") : text;
            textLayer.Mutate(ctx => ctx.DrawText(options, finalText, color));
            canvas.Mutate(ctx => ctx.DrawImage(textLayer, new Point(x, y), 1f));
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
            return Math.Clamp((float)(text.Size.Value * cardWidth), 8f, 220f);
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
                Path.Combine(_environment.ContentRootPath, "fonts"),
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
                        var family = _fontCollection.Add(file);
                        var alias = Path.GetFileNameWithoutExtension(file);
                        if (!string.IsNullOrWhiteSpace(alias) && !_fontFamilies.ContainsKey(alias))
                        {
                            _fontFamilies[alias] = family;
                        }

                        if (!_fontFamilies.ContainsKey(family.Name))
                        {
                            _fontFamilies[family.Name] = family;
                        }
                    }
                    catch
                    {
                        // Some fonts may fail to load in certain environments; keep processing others.
                    }
                }
            }

            _fontsLoaded = true;
        }
    }

    private Font ResolveFont(string? familyName, float size, string? style)
    {
        var fontStyle = FontStyle.Regular;
        if (!string.IsNullOrWhiteSpace(style))
        {
            if (style.Contains("bold", StringComparison.OrdinalIgnoreCase))
            {
                fontStyle |= FontStyle.Bold;
            }

            if (style.Contains("italic", StringComparison.OrdinalIgnoreCase))
            {
                fontStyle |= FontStyle.Italic;
            }
        }

        if (!string.IsNullOrWhiteSpace(familyName))
        {
            var normalized = familyName.Trim('"', '\'', ' ').ToLowerInvariant();
            if (_fontFamilies.TryGetValue(normalized, out var familyByAlias))
            {
                return familyByAlias.CreateFont(size, fontStyle);
            }

            var byContains = _fontFamilies.FirstOrDefault(pair =>
                pair.Key.Contains(normalized, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(byContains.Key))
            {
                return byContains.Value.CreateFont(size, fontStyle);
            }
        }

        if (_fontFamilies.Count > 0)
        {
            return _fontFamilies.First().Value.CreateFont(size, fontStyle);
        }

        return SystemFonts.Get("Arial").CreateFont(size, fontStyle);
    }

    private static string NormalizeText(string input)
    {
        var text = input
            .Replace("{line}", "\n", StringComparison.OrdinalIgnoreCase)
            .Replace("{lns}", "\n", StringComparison.OrdinalIgnoreCase)
            .Replace("{i}", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("{/i}", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("{bold}", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("{/bold}", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("{/font}", string.Empty, StringComparison.OrdinalIgnoreCase);

        var builder = new StringBuilder(text.Length);
        var insideTag = false;
        foreach (var c in text)
        {
            if (c == '{')
            {
                insideTag = true;
                continue;
            }

            if (insideTag)
            {
                if (c == '}')
                {
                    insideTag = false;
                }

                continue;
            }

            builder.Append(c);
        }

        return builder.ToString();
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

    private static void ApplyErase(Image<Rgba32> canvas, Image<Rgba32> layer, float opacity)
    {
        canvas.ProcessPixelRows(layer, (canvasRows, layerRows) =>
        {
            for (var y = 0; y < canvasRows.Height; y++)
            {
                var canvasRow = canvasRows.GetRowSpan(y);
                var layerRow = layerRows.GetRowSpan(y);

                for (var x = 0; x < canvasRow.Length; x++)
                {
                    if (layerRow[x].A == 0)
                    {
                        continue;
                    }

                    var eraseAlpha = (byte)Math.Clamp(layerRow[x].A * opacity, 0, 255);
                    canvasRow[x].A = (byte)Math.Clamp(canvasRow[x].A - eraseAlpha, 0, 255);
                }
            }
        });
    }

    private static void ApplyPreserveAlphaBlend(Image<Rgba32> canvas, Image<Rgba32> layer, float opacity)
    {
        canvas.ProcessPixelRows(layer, (canvasRows, layerRows) =>
        {
            for (var y = 0; y < canvasRows.Height; y++)
            {
                var canvasRow = canvasRows.GetRowSpan(y);
                var layerRow = layerRows.GetRowSpan(y);

                for (var x = 0; x < canvasRow.Length; x++)
                {
                    if (layerRow[x].A == 0)
                    {
                        continue;
                    }

                    var blend = (layerRow[x].A / 255f) * opacity;
                    canvasRow[x].R = (byte)Math.Clamp(canvasRow[x].R * (1 - blend) + layerRow[x].R * blend, 0, 255);
                    canvasRow[x].G = (byte)Math.Clamp(canvasRow[x].G * (1 - blend) + layerRow[x].G * blend, 0, 255);
                    canvasRow[x].B = (byte)Math.Clamp(canvasRow[x].B * (1 - blend) + layerRow[x].B * blend, 0, 255);
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
        canvas.Mutate(ctx => ctx.Resize(width, height));
    }

    private static Color ParseColor(string? value, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
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
}


