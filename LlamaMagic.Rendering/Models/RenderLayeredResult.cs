namespace LlamaMagic.Rendering.Models;

public sealed class RenderLayeredResult
{
    public RenderLayeredResult(Stream artLayerStream, Stream textLayerStream)
    {
        ArtLayerStream = artLayerStream;
        TextLayerStream = textLayerStream;
    }

    public Stream ArtLayerStream { get; }
    public Stream TextLayerStream { get; }
}

