using CardConjurer.Models.CardImage;

namespace CardConjurer.Services.CardImage;

public interface ICardRenderV2Service
{
    Task<Stream> RenderAsync(
        CardData card,
        bool preview,
        int? maxDimension,
        string? cardSizeProfileName,
        bool isPrintImage,
        CancellationToken cancellationToken = default);
}

