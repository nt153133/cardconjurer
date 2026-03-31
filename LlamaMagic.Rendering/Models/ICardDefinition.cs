namespace LlamaMagic.Rendering.Models;

public interface ICardDefinition
{
    int? Width { get; }
    int? Height { get; }
    bool? Margins { get; }
    double? MarginX { get; }
    double? MarginY { get; }
    string? ArtSource { get; }
    double? ArtX { get; }
    double? ArtY { get; }
    double? ArtZoom { get; }
    double? ArtRotate { get; }
    string? SetSymbolSource { get; }
    double? SetSymbolX { get; }
    double? SetSymbolY { get; }
    double? SetSymbolZoom { get; }
    IBoundsDefinition? SetSymbolBounds { get; }
    string? Version { get; }
    IEnumerable<IFrameDefinition>? Frames { get; }
    IDictionary<string, ITextBlockDefinition?>? Text { get; }

    /// <summary>Gets the title text for card-name substitution in text rendering.</summary>
    string? GetTitle();
}

