namespace LlamaMagic.Rendering.Models;

public interface ITextBlockDefinition
{
    string? Text { get; }
    string? Name { get; }
    string? Font { get; }
    string? FontStyle { get; }
    double? FontSize { get; }
    string? Color { get; }
    double? X { get; }
    double? Y { get; }
    double? Width { get; }
    double? Height { get; }
    double? Size { get; }
    string? Align { get; }
    string? Justify { get; }
    bool? OneLine { get; }
    bool? ManaCost { get; }
    string? ManaPrefix { get; }
    string? ManaSymbolColor { get; }
    string? ConditionalColor { get; }
    bool? Vertical { get; }
    bool? AllCaps { get; }
    bool? Bounded { get; }
    string? Shadow { get; }
    double? ShadowX { get; }
    double? ShadowY { get; }
    double? ShadowBlur { get; }
    double? Rotation { get; }
    double? Kerning { get; }
    double? LineSpacing { get; }
    string? OutlineColor { get; }
    double? OutlineWidth { get; }
    string? LineCap { get; }
    string? LineJoin { get; }
    double? ArcRadius { get; }
    double? ArcStart { get; }
    double? ManaSpacing { get; }
    double? ManaImageScale { get; }
    bool? NoVerticalCenter { get; }
}

