using CardConjurer.Models.CardImage;

namespace CardConjurer.Services.CardImage;

public interface ICardRenderV2Service
{
    Task<Stream> RenderAsync(CardData card, bool preview, int? maxDimension, CancellationToken cancellationToken = default);
}

