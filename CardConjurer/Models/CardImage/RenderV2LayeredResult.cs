namespace CardConjurer.Models.CardImage;

public sealed class RenderV2LayeredResult
{
    public RenderV2LayeredResult(Stream artLayerStream, Stream textLayerStream)
    {
        ArtLayerStream = artLayerStream;
        TextLayerStream = textLayerStream;
    }

    public Stream ArtLayerStream { get; }
    public Stream TextLayerStream { get; }
}

