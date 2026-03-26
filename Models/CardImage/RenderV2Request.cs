using System.Text.Json;

namespace CardConjurer.Models.CardImage;

public sealed class RenderV2Request
{
    public JsonElement CardJson { get; init; }
    public int? MaxDimension { get; init; }
    public string? CardSizeProfileName { get; init; }
    public bool IsPrintImage { get; init; }
}

