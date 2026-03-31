using SixLabors.ImageSharp;

namespace CardConjurer.Models.CardImage.Sizing;

/// <summary>
/// Card-size profile used by the app when selecting export dimensions.
/// The two primary values consumed by the current UI flow are <see cref="CutSize"/>
/// (card width/height) and <see cref="BleedSize"/> (output size with margins).
/// </summary>
public sealed class CardSizeProfile :IBasicCardDimensions
{
    private const float MillimetersPerInch = 25.4f;
    private const float MetricCutWidthMm = 63f;
    private const float MetricCutHeightMm = 88f;
    private const float SafeInsetInches = 0.09625f; // ~2.445 mm

    /// <summary>
    /// Default bleed margin in inches (36 px at 300 DPI).
    /// </summary>
    public const float DefaultMarginInches = 36f / 300f;

    /// <summary>
    /// Creates a standard profile from DPI and margin.
    /// </summary>
    /// <param name="name">Profile display name.</param>
    /// <param name="dpi">Dots-per-inch used to derive pixel dimensions.</param>
    /// <param name="marginInches">Bleed margin on one side, in inches.</param>
    /// <param name="useTwoPointFiveByThreePointFive">
    /// Uses 2.5" x 3.5" for cut size instead of 63 mm x 88 mm.
    /// </param>
    public CardSizeProfile(string name, int dpi, float marginInches = DefaultMarginInches, bool useTwoPointFiveByThreePointFive = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(dpi, 0);
        ArgumentOutOfRangeException.ThrowIfNegative(marginInches);

        Name = name;
        Dpi = dpi;
        Margin = marginInches;

        var cutWidthInches = useTwoPointFiveByThreePointFive ? 2.5f : MetricCutWidthMm / MillimetersPerInch;
        var cutHeightInches = useTwoPointFiveByThreePointFive ? 3.5f : MetricCutHeightMm / MillimetersPerInch;

        var cutWidthPixels = cutWidthInches * dpi;
        var cutHeightPixels = cutHeightInches * dpi;
        var marginPixels = marginInches * dpi;
        var safeInsetPixels = SafeInsetInches * dpi;

        CutSize = new Size(RoundToEven(cutWidthPixels), RoundToEven(cutHeightPixels));
        BleedSize = new Size(RoundToInt(cutWidthPixels + (marginPixels * 2f)), RoundToInt(cutHeightPixels + (marginPixels * 2f)));
        SafeSize = new Size(RoundToEven(cutWidthPixels - (safeInsetPixels * 2f)), RoundToEven(cutHeightPixels - (safeInsetPixels * 2f)));
    }

    /// <summary>
    /// Creates a profile from explicit pixel sizes.
    /// </summary>
    /// <param name="name">Profile display name.</param>
    /// <param name="cutSize">Card cut dimensions in pixels.</param>
    /// <param name="bleedSize">Card bleed dimensions in pixels.</param>
    /// <param name="safeSize">Card safe-zone dimensions in pixels.</param>
    /// <param name="dpi">
    /// Optional DPI. If omitted, DPI is estimated from width and the metric cut width.
    /// </param>
    public CardSizeProfile(string name, Size cutSize, Size bleedSize, Size safeSize, int? dpi = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(cutSize.Width, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(cutSize.Height, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(bleedSize.Width, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(bleedSize.Height, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(safeSize.Width, 0);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(safeSize.Height, 0);

        Name = name;
        CutSize = cutSize;
        BleedSize = bleedSize;
        SafeSize = safeSize;

        Dpi = dpi ?? Math.Max(1, RoundToInt(cutSize.Width / (MetricCutWidthMm / MillimetersPerInch)));
        Margin = (BleedSize.Width - CutSize.Width) / 2f / Dpi;
    }

    /// <summary>
    /// Profile display name. Safe to bind directly in dropdown UIs.
    /// </summary>
    public string Name { get; set; }

    public SizeF SizeInInches => new SizeF(CutSize.Width / (float)Dpi, CutSize.Height / (float)Dpi);

    /// <summary>
    /// Base profile DPI.
    /// </summary>
    public int Dpi { get; set; }

    /// <summary>
    /// Bleed margin per side, in inches.
    /// </summary>
    public float Margin { get; }

    /// <summary>
    /// Uniform margin scale relative to cut size, used by the JS canvas margin pipeline.
    /// This is the <b>per-side</b> scale. The JS <c>sizeCanvas</c> function applies it as
    /// <c>card.width * (1 + 2 * marginX)</c>, so this must be the half-margin:
    /// <c>(BleedWidth - CutWidth) / (2 * CutWidth)</c>.
    /// </summary>
    public float MarginScale => MarginScaleX;

    /// <summary>
    /// Horizontal per-side margin scale relative to cut width.
    /// Applied by JS as <c>card.width * (1 + 2 * MarginScaleX)</c> to produce the bleed width.
    /// </summary>
    public float MarginScaleX => CutSize.Width <= 0 ? 0f : (BleedSize.Width - CutSize.Width) / (2f * CutSize.Width);

    /// <summary>
    /// Vertical per-side margin scale relative to cut height.
    /// Applied by JS as <c>card.height * (1 + 2 * MarginScaleY)</c> to produce the bleed height.
    /// </summary>
    public float MarginScaleY => CutSize.Height <= 0 ? 0f : (BleedSize.Height - CutSize.Height) / (2f * CutSize.Height);

    /// <summary>
    /// Card cut dimensions in pixels (card width/height).
    /// </summary>
    public Size CutSize { get; }

    /// <summary>
    /// Card bleed dimensions in pixels (cut size + margins).
    /// </summary>
    public Size BleedSize { get; }

    /// <summary>
    /// Card safe-zone dimensions in pixels.
    /// </summary>
    public Size SafeSize { get; }

    /// <summary>
    /// Horizontal offset from bleed origin to cut origin, in pixels.
    /// </summary>
    public float OffsetX => (BleedSize.Width - CutSize.Width) / 2f;

    /// <summary>
    /// Vertical offset from bleed origin to cut origin, in pixels.
    /// </summary>
    public float OffsetY => (BleedSize.Height - CutSize.Height) / 2f;

    /// <summary>
    /// Cut rectangle inside bleed space.
    /// </summary>
    public RectangleF CutArea => new(OffsetX, OffsetY, CutSize.Width, CutSize.Height);

    /// <summary>
    /// Full bleed rectangle.
    /// </summary>
    public RectangleF BleedArea => new(0, 0, BleedSize.Width, BleedSize.Height);

    /// <summary>
    /// Safe-zone rectangle centered in bleed space.
    /// </summary>
    public RectangleF SafeArea => new((BleedSize.Width - SafeSize.Width) / 2f, (BleedSize.Height - SafeSize.Height) / 2f, SafeSize.Width, SafeSize.Height);

    /// <summary>
    /// Cut width in inches.
    /// </summary>
    public float WidthInInches => CutSize.Width / (float)Dpi;

    /// <summary>
    /// Cut height in inches.
    /// </summary>
    public float HeightInInches => CutSize.Height / (float)Dpi;

    /// <summary>
    /// Cut width in millimeters.
    /// </summary>
    public float WidthInMm => WidthInInches * MillimetersPerInch;

    /// <summary>
    /// Cut height in millimeters.
    /// </summary>
    public float HeightInMm => HeightInInches * MillimetersPerInch;

    /// <summary>
    /// Friendly string for diagnostics and logs.
    /// </summary>
    public string DimensionsString =>
        $"{WidthInMm:F2}mm x {HeightInMm:F2}mm | {CutSize.Width}px x {CutSize.Height}px | {WidthInInches:F3}\" x {HeightInInches:F3}\"";

    public SizeF SizeInMm => new SizeF(WidthInMm, HeightInMm);

    /// <summary>
    /// Validates that the margin scale will produce the expected bleed size.
    /// JS formula: <c>cut * (1 + 2 * marginScale) = bleed</c>
    /// </summary>
    public string MarginScaleDebugString =>
        $"Cut: {CutSize.Width}×{CutSize.Height} → Bleed: {BleedSize.Width}×{BleedSize.Height} | " +
        $"MarginX: {MarginScaleX:F6} ({CutSize.Width} × (1 + 2×{MarginScaleX:F6}) = {(int)(CutSize.Width * (1 + 2 * MarginScaleX))} expected {BleedSize.Width}) | " +
        $"MarginY: {MarginScaleY:F6} ({CutSize.Height} × (1 + 2×{MarginScaleY:F6}) = {(int)(CutSize.Height * (1 + 2 * MarginScaleY))} expected {BleedSize.Height})";

    /// <summary>
    /// Factory for standard MTG profile dimensions.
    /// </summary>
    public static CardSizeProfile StandardCard(int dpi, float marginInches = DefaultMarginInches, bool useTwoPointFiveByThreePointFive = false)
        => new($"Standard_{dpi}dpi", dpi, marginInches, useTwoPointFiveByThreePointFive);

    /// <summary>
    /// Rounds to nearest integer.
    /// </summary>
    public static int RoundToInt(float value) => (int)MathF.Round(value, MidpointRounding.AwayFromZero);

    private static int RoundToEven(float value)
    {
        var rounded = RoundToInt(value);
        return rounded % 2 == 0 ? rounded : rounded - 1;
    }

    /// <inheritdoc />
    public override string ToString() => $"{Name} ({CutSize.Width}x{CutSize.Height} cut, {BleedSize.Width}x{BleedSize.Height} bleed @ {Dpi}dpi)";
}