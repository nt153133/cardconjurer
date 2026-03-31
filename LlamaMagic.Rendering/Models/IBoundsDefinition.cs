namespace LlamaMagic.Rendering.Models;

public interface IBoundsDefinition
{
    double? X { get; }
    double? Y { get; }
    double? Width { get; }
    double? Height { get; }
    string? Horizontal { get; }
    string? Vertical { get; }
}

