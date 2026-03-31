using LlamaMagic.Rendering.Models;

namespace LlamaMagic.Rendering;

public interface ILlamaRenderService
{
    Task<Stream> RenderAsync(
        ICardDefinition card,
        bool preview,
        int? maxDimension,
        string? cardSizeProfileName,
        bool isPrintImage,
        CancellationToken cancellationToken = default);

    Task<RenderLayeredResult> RenderLayeredAsync(
        ICardDefinition card,
        bool preview,
        int? maxDimension,
        string? cardSizeProfileName,
        bool isPrintImage,
        CancellationToken cancellationToken = default);
}
