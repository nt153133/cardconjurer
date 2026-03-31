using CardConjurer.Models.CardImage;
using CardConjurer.Models.CardImage.Sizing;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Png.Chunks;
using SixLabors.ImageSharp.Metadata.Profiles.Xmp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace CardConjurer.Services.CardImage;

public sealed class CardImageService : ICardImageService
{
    // iTXt keyword used in PNG metadata chunks — kept short to stay within PNG spec limits
    private const string PngMetaKeyword = "CardConjurer-Data";

    public async Task<Stream> ProcessAsync(
        byte[] sourceImageBytes,
        string format,
        string? cardJsonMetadata,
        CancellationToken cancellationToken = default)
    {
        using var sourceStream = new MemoryStream(sourceImageBytes);

        // Load the canvas PNG into ImageSharp.
        // ─────────────────────────────────────────────────────────────────
        // Future pipeline steps (resize, bleed crop, watermark, etc.) go
        // here, between Load and EmbedMetadata, using image.Mutate(ctx => …)
        // ─────────────────────────────────────────────────────────────────
        using var image = await Image<Rgb48>.LoadAsync(sourceStream, cancellationToken);

        CardData? cardData = null;
        if (!string.IsNullOrEmpty(cardJsonMetadata))
        {
            EmbedMetadata(image, cardJsonMetadata, format);
            cardData = CardData.FromJson(cardJsonMetadata);
        }
        
        var outputStream = new MemoryStream();

        if (string.Equals(format, "jpeg", StringComparison.OrdinalIgnoreCase))
        {
            var encoder = new JpegEncoder { Quality = 92 };
            await image.SaveAsJpegAsync(outputStream, encoder, cancellationToken);
        }
        else
        {
            var encoder =  new PngEncoder
            {
                ColorType = PngColorType.Rgb,
                CompressionLevel = PngCompressionLevel.Level6,
                FilterMethod = PngFilterMethod.Adaptive,
                BitDepth = PngBitDepth.Bit8,
            };
            
            await image.SaveAsPngAsync(outputStream, encoder, cancellationToken);
        }

        outputStream.Seek(0, SeekOrigin.Begin);
        return outputStream;
    }

    public async Task<Stream> ProcessAsync(byte[] sourceImageBytes, string format, string? cardJsonMetadata, string? requestCardSizeProfileName, bool requestIsPrintImage, CancellationToken cancellationToken)
    {
        using var sourceStream = new MemoryStream(sourceImageBytes);

        // Load the canvas PNG into ImageSharp.
        // ─────────────────────────────────────────────────────────────────
        // Future pipeline steps (resize, bleed crop, watermark, etc.) go
        // here, between Load and EmbedMetadata, using image.Mutate(ctx => …)
        // ─────────────────────────────────────────────────────────────────

        var image = await Image.LoadAsync<Rgba32>(sourceStream, cancellationToken);

        var gotProfile  = CardSizeCatalog.TryGetByName(requestCardSizeProfileName, out var cardSizeProfile);

        if (gotProfile)
        {
            if (!requestIsPrintImage)
            {
                var cropDimensions = cardSizeProfile.CutSize;
                //crop from center
                image.Mutate(ctx => ctx.Crop(new Rectangle(
                    x: image.Width / 2 - cropDimensions.Width / 2,
                    y: image.Height / 2 - cropDimensions.Height / 2,
                    width: cropDimensions.Width,
                    height: cropDimensions.Height)));
            }
            else
            {
                image = BleedAdder.AddBleed(image, cardSizeProfile);
            }
        }

        CardData? cardData = null;
        if (!string.IsNullOrEmpty(cardJsonMetadata))
        {
            EmbedMetadata(image, cardJsonMetadata, format);
            cardData = CardData.FromJson(cardJsonMetadata);
        }
        
        var outputStream = new MemoryStream();

        if (string.Equals(format, "jpeg", StringComparison.OrdinalIgnoreCase))
        {
            var encoder = new JpegEncoder { Quality = 92 };
            await image.SaveAsJpegAsync(outputStream, encoder, cancellationToken);
        }
        else
        {
            var encoder =  new PngEncoder
            {
                ColorType = PngColorType.RgbWithAlpha,
                CompressionLevel = PngCompressionLevel.Level6,
                FilterMethod = PngFilterMethod.Adaptive,
                BitDepth = PngBitDepth.Bit8,
            };
            
            await image.SaveAsPngAsync(outputStream, encoder, cancellationToken);
        }

        image.Dispose();
        outputStream.Seek(0, SeekOrigin.Begin);
        return outputStream;
    }

    private static void EmbedMetadata(Image image, string cardJson, string format)
    {
        if (string.Equals(format, "jpeg", StringComparison.OrdinalIgnoreCase))
        {
            // JPEG has no native text chunks; embed as an XMP packet
            var xmpBytes = System.Text.Encoding.UTF8.GetBytes(BuildXmpPacket(cardJson));
            image.Metadata.XmpProfile = new XmpProfile(xmpBytes);
        }
        else
        {
            // PNG: write as an iTXt chunk (international text, supports UTF-8)
            var pngMeta = image.Metadata.GetFormatMetadata(PngFormat.Instance);
            pngMeta.TextData.Add(new PngTextData(
                keyword: PngMetaKeyword,
                value: cardJson,
                languageTag: string.Empty,
                translatedKeyword: string.Empty));
        }
    }

    /// <summary>
    /// Wraps raw JSON in a minimal XMP packet so JPEG readers can find it.
    /// Tools like ExifTool read this via the CardConjurer namespace property.
    /// </summary>
    private static string BuildXmpPacket(string cardJson)
    {
        var escaped = System.Security.SecurityElement.Escape(cardJson) ?? cardJson;
        return $"""
            <?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?>
            <x:xmpmeta xmlns:x='adobe:ns:meta/'>
              <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
                <rdf:Description rdf:about='' xmlns:cc='https://cardconjurer.app/ns/'>
                  <cc:CardData>{escaped}</cc:CardData>
                </rdf:Description>
              </rdf:RDF>
            </x:xmpmeta>
            <?xpacket end='w'?>
            """;
    }
}
