namespace CardConjurer.Models.CardImage;

public sealed class PrepressPipelineOptions
{
    // Stage-1 target validation. Keep nullable while print-size contract is being finalized.
    public int? ExpectedWidth { get; init; }
    public int? ExpectedHeight { get; init; }

    // Stage-1 baseline RGB assumption used by later ICC operations.
    public string BaselineRgbProfileName { get; init; } = "sRGB IEC61966-2.1";

    // Stage-3 destination CMYK profile placeholder for future conversion.
    public string TargetCmykProfileName { get; init; } = "PSO Coated v3";

    // Stage-5 export metadata placeholder.
    public int ExportDpi { get; init; } = 812;
}

