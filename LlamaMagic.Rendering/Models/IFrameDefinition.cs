namespace LlamaMagic.Rendering.Models;

public interface IFrameDefinition
{
    string? Src { get; }
    double? Opacity { get; }
    bool? PreserveAlpha { get; }
    bool? Erase { get; }
    bool? ColorOverlayCheck { get; }
    string? ColorOverlay { get; }
    double? HslHue { get; }
    double? HslSaturation { get; }
    double? HslLightness { get; }
    IBoundsDefinition? Bounds { get; }
    IBoundsDefinition? OgBounds { get; }
    IEnumerable<IMaskDefinition>? Masks { get; }
}

