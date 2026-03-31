using SixLabors.ImageSharp;

namespace CardConjurer.Models.CardImage.Sizing;

public interface IBasicCardDimensions
{
    /// <summary>Gets the pixel-snapped integer size of the cut area.</summary>
    Size CutSize { get; }

    /// <summary>Gets the pixel-snapped integer size of the bleed area (the full canvas).</summary>
    Size BleedSize { get; }

    /// <summary>Gets the pixel-snapped integer size of the safe area.</summary>
    Size SafeSize { get; }

    /// <summary>Gets a human-readable string listing the physical and pixel dimensions of the cut area.</summary>
    string DimensionsString { get; }

    /// <summary>Gets the cut-area size expressed in millimetres.</summary>
    SizeF SizeInMm { get; }

    /// <summary>Gets the cut-area size expressed in inches.</summary>
    SizeF SizeInInches { get; }

    /// <summary>Gets the target print resolution in dots per inch.</summary>
    int Dpi { get; }

    /// <summary>Gets a descriptive name for this dimension preset (e.g. <c>"Standard_300dpi"</c>).</summary>
    string Name { get; }

    /// <summary>Gets the bleed margin expressed in inches (half the total bleed padding on each side).</summary>
    float Margin { get; }
}