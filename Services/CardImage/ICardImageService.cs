namespace CardConjurer.Services.CardImage;

public interface ICardImageService
{
    /// <summary>
    /// Takes raw PNG bytes from the browser canvas, optionally embeds card JSON
    /// as image metadata, re-encodes to the requested format, and returns the
    /// processed stream ready to send to the browser as a file download.
    /// This is the entry point for the ImageSharp pipeline — future resize,
    /// watermark, and bleed operations slot in inside ProcessAsync before encoding.
    /// </summary>
    Task<Stream> ProcessAsync(
        byte[] sourceImageBytes,
        string format,
        string? cardJsonMetadata,
        CancellationToken cancellationToken = default);
}
