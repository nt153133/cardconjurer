namespace CardConjurer.Models.Assets;

public static class AssetKinds
{
    public const string Art = "art";
    public const string Frames = "frames";
    public const string SetSymbols = "set-symbols";
    public const string Watermarks = "watermarks";
    public const string Misc = "misc";

    public static readonly HashSet<string> Supported = new(StringComparer.OrdinalIgnoreCase)
    {
        Art,
        Frames,
        SetSymbols,
        Watermarks,
        Misc
    };

    public static bool IsSupported(string? kind)
    {
        return !string.IsNullOrWhiteSpace(kind) && Supported.Contains(kind);
    }
}
