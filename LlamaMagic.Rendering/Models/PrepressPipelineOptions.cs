using ImageMagick;
using LlamaMagic.Rendering.Sizing;

namespace LlamaMagic.Rendering.Models;

public sealed class PrepressPipelineOptions
{
    // Stage-1 target validation. Keep nullable while print-size contract is being finalized.
    public int? ExpectedWidth => CardDimensions.BleedSize.Width;
    public int? ExpectedHeight => CardDimensions.BleedSize.Height;
    
    public IBasicCardDimensions CardDimensions { get; init; } 

    // Stage-1 baseline RGB assumption used by later ICC operations.
    public string BaselineRgbProfileName { get; init; } = "sRGB IEC61966-2.1";

    // Stage-3 destination CMYK profile placeholder for future conversion.
    public string TargetCmykProfileName { get; init; } = "PSO Coated v3";

    // Stage-5 export metadata placeholder.
    public int ExportDpi => CardDimensions.Dpi;

    public static ColorProfile MPC { get; } = LoadPsoCoatedProfile();
    
    // Load PSOcoated_v3.icc from embedded resources
    public static ColorProfile LoadPsoCoatedProfile()
    {
        using var stream = typeof(PrepressPipelineOptions).Assembly.GetManifestResourceStream("LlamaMagic.Rendering.Resources.PSOcoated_v3.icc");
        if (stream == null)
            throw new InvalidOperationException("Could not find embedded resource: LlamaMagic.Rendering.Resources.PSOcoated_v3.icc");
        return new ColorProfile(stream);
    }
}

