using CardConjurer.Models.CardImage;

namespace CardConjurer.Services.CardImage;

public interface IPrepressService
{
    Task<Stream> ProcessPrintPipelineAsync(
        Stream artLayerStream,
        Stream textLayerStream,
        PrepressPipelineOptions options,
        CancellationToken cancellationToken = default);
}

