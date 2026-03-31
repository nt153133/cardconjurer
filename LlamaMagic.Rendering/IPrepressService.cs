using LlamaMagic.Rendering.Models;

namespace LlamaMagic.Rendering;

public interface IPrepressService
{
    Task<Stream> ProcessPrintPipelineAsync(
        Stream artLayerStream,
        Stream textLayerStream,
        PrepressPipelineOptions options,
        CancellationToken cancellationToken = default);
}
