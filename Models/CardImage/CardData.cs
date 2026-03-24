using System.Text.Json;
using System.Text.Json.Serialization;
using System.Globalization;
using Serilog;

namespace CardConjurer.Models.CardImage;

/// <summary>
/// Deserialised representation of the JavaScript <c>card</c> object sent from
/// the browser canvas when downloading or rendering a card image.
/// All fields are nullable so partial / legacy card saves don't break.
/// </summary>
public sealed class CardData
{
    // ── Canvas / layout ──────────────────────────────────────────────────
    [JsonPropertyName("width")]        public int? Width        { get; init; }
    [JsonPropertyName("height")]       public int? Height       { get; init; }
    [JsonPropertyName("marginX")]      public double? MarginX   { get; init; }
    [JsonPropertyName("marginY")]      public double? MarginY   { get; init; }
    [JsonPropertyName("version")]      public string? Version   { get; init; }
    [JsonPropertyName("noCorners")]    public bool? NoCorners   { get; init; }
    [JsonPropertyName("landscape")]    public bool? Landscape   { get; init; }

    // ── Art ──────────────────────────────────────────────────────────────
    [JsonPropertyName("artSource")]    public string? ArtSource { get; init; }
    [JsonPropertyName("artX")]         public double? ArtX      { get; init; }
    [JsonPropertyName("artY")]         public double? ArtY      { get; init; }
    [JsonPropertyName("artZoom")]      public double? ArtZoom   { get; init; }
    [JsonPropertyName("artRotate")]    public double? ArtRotate { get; init; }
    [JsonPropertyName("artBounds")]    public CardBounds? ArtBounds { get; init; }

    // ── Set symbol ───────────────────────────────────────────────────────
    [JsonPropertyName("setSymbolSource")] public string? SetSymbolSource { get; init; }
    [JsonPropertyName("setSymbolX")]      public double? SetSymbolX      { get; init; }
    [JsonPropertyName("setSymbolY")]      public double? SetSymbolY      { get; init; }
    [JsonPropertyName("setSymbolZoom")]   public double? SetSymbolZoom   { get; init; }
    [JsonPropertyName("setSymbolBounds")] public CardSymbolBounds? SetSymbolBounds { get; init; }

    // ── Watermark ────────────────────────────────────────────────────────
    [JsonPropertyName("watermarkSource")]  public string? WatermarkSource  { get; init; }
    [JsonPropertyName("watermarkX")]       public double? WatermarkX       { get; init; }
    [JsonPropertyName("watermarkY")]       public double? WatermarkY       { get; init; }
    [JsonPropertyName("watermarkZoom")]    public double? WatermarkZoom    { get; init; }
    [JsonPropertyName("watermarkLeft")]    public string? WatermarkLeft    { get; init; }
    [JsonPropertyName("watermarkRight")]   public string? WatermarkRight   { get; init; }
    [JsonPropertyName("watermarkOpacity")] public double? WatermarkOpacity { get; init; }
    [JsonPropertyName("watermarkBounds")]  public CardBounds? WatermarkBounds { get; init; }

    // ── Collector / bottom info ──────────────────────────────────────────
    [JsonPropertyName("infoArtist")]   public string? InfoArtist   { get; init; }
    [JsonPropertyName("infoNumber")]   public string? InfoNumber   { get; init; }
    [JsonPropertyName("infoRarity")]   public string? InfoRarity   { get; init; }
    [JsonPropertyName("infoSet")]      public string? InfoSet      { get; init; }
    [JsonPropertyName("infoLanguage")] public string? InfoLanguage { get; init; }
    [JsonPropertyName("infoNote")]     public string? InfoNote     { get; init; }
    [JsonPropertyName("infoYear")]     public int?    InfoYear     { get; init; }

    // ── Text boxes ───────────────────────────────────────────────────────
    /// <summary>
    /// Dictionary keyed by text-box name (e.g. "title", "mana", "rules", "type", "pt").
    /// Use <see cref="CardTextObject"/> for typed access.
    /// </summary>
    [JsonPropertyName("text")]
    public Dictionary<string, CardTextObject?>? Text { get; init; }

    // ── Frames ───────────────────────────────────────────────────────────
    [JsonPropertyName("frames")]       public List<CardFrame>? Frames       { get; init; }
    [JsonPropertyName("manaSymbols")]  public List<string>?    ManaSymbols  { get; init; }
    [JsonPropertyName("onload")]       public string?          Onload       { get; init; }

    // ── Serial number ────────────────────────────────────────────────────
    [JsonPropertyName("serialNumber")] public string? SerialNumber { get; init; }
    [JsonPropertyName("serialTotal")]  public string? SerialTotal  { get; init; }
    // Legacy creator saves can emit empty strings for serial numeric fields.
    [JsonConverter(typeof(EmptyStringNullableDoubleConverter))]
    [JsonPropertyName("serialX")]      public double? SerialX      { get; init; }
    [JsonConverter(typeof(EmptyStringNullableDoubleConverter))]
    [JsonPropertyName("serialY")]      public double? SerialY      { get; init; }
    [JsonConverter(typeof(EmptyStringNullableDoubleConverter))]
    [JsonPropertyName("serialScale")]  public double? SerialScale  { get; init; }

    // ── Bottom info layout ───────────────────────────────────────────────
    // bottomInfo is a keyed object on the JS side (e.g. {midLeft:{...}}),
    // so accept it as a raw JsonElement rather than List<JsonElement>.
    [JsonPropertyName("bottomInfo")]          public JsonElement? BottomInfo              { get; init; }
    [JsonPropertyName("bottomInfoTranslate")] public CardPoint? BottomInfoTranslate       { get; init; }
    [JsonPropertyName("bottomInfoRotate")]    public double? BottomInfoRotate              { get; init; }
    [JsonPropertyName("bottomInfoZoom")]      public double? BottomInfoZoom               { get; init; }
    [JsonPropertyName("bottomInfoColor")]     public string? BottomInfoColor              { get; init; }
    [JsonPropertyName("hideBottomInfoBorder")] public bool? HideBottomInfoBorder          { get; init; }

    // ── Misc rendering flags ─────────────────────────────────────────────
    [JsonPropertyName("showsFlavorBar")]     public bool? ShowsFlavorBar    { get; init; }
    [JsonPropertyName("margins")]            public bool? Margins           { get; init; }

    // ── Planeswalker ─────────────────────────────────────────────────────
    [JsonPropertyName("saga")]               public JsonElement? Saga       { get; init; }
    [JsonPropertyName("class")]              public JsonElement? Class      { get; init; }

    // ── Convenience helpers ──────────────────────────────────────────────

    /// <summary>Gets the title text, or null if the text block is absent.</summary>
    public string? GetTitle()   => TryGetText("title")?.Text;

    /// <summary>Gets the mana cost string, or null.</summary>
    public string? GetManaCost() => TryGetText("mana")?.Text;

    /// <summary>Gets the type line, or null.</summary>
    public string? GetTypeLine() => TryGetText("type")?.Text;

    /// <summary>Gets the rules text, or null.</summary>
    public string? GetRulesText() => TryGetText("rules")?.Text;

    /// <summary>Gets the P/T string, or null.</summary>
    public string? GetPowerToughness() => TryGetText("pt")?.Text;

    private CardTextObject? TryGetText(string key) =>
        Text is not null && Text.TryGetValue(key, out var t) ? t : null;

    /// <summary>
    /// Deserializes card data from a raw JSON string (e.g. from PNG iTXt metadata).
    /// Returns null if the string is null/empty or cannot be parsed.
    /// </summary>
    public static CardData? FromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<CardData>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Deserializes card data from an already-parsed <see cref="JsonElement"/>.
    /// </summary>
    public static CardData? FromJsonElement(JsonElement element)
    {
        if (element.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined) return null;
        try
        {
            return element.Deserialize<CardData>(JsonOptions);
        }
        catch (JsonException e)
        {
            Log.Error("Error deserializing CardData from JsonElement: {0}", element);
            Log.Error("Exception: {0}", e);
            return null;
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        // JS cards sometimes encode numbers as strings (e.g. artRotate:"0", infoYear:"2026").
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingDefault,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };
}

internal sealed class EmptyStringNullableDoubleConverter : JsonConverter<double?>
{
    public override double? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }

        if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetDouble();
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s))
            {
                return null;
            }

            if (double.TryParse(s, NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var value))
            {
                return value;
            }

            throw new JsonException($"Could not parse '{s}' as a double.");
        }

        throw new JsonException($"Unexpected token {reader.TokenType} when parsing nullable double.");
    }

    public override void Write(Utf8JsonWriter writer, double? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
        {
            writer.WriteNumberValue(value.Value);
            return;
        }

        writer.WriteNullValue();
    }
}

/// <summary>A single card text box definition.</summary>
public sealed class CardTextObject
{
    [JsonPropertyName("text")]       public string? Text       { get; init; }
    [JsonPropertyName("name")]       public string? Name       { get; init; }
    [JsonPropertyName("font")]       public string? Font       { get; init; }
    [JsonPropertyName("fontStyle")]  public string? FontStyle  { get; init; }
    [JsonConverter(typeof(EmptyStringNullableDoubleConverter))]
    [JsonPropertyName("fontSize")]   public double? FontSize   { get; init; }
    [JsonPropertyName("color")]      public string? Color      { get; init; }
    [JsonPropertyName("x")]          public double? X          { get; init; }
    [JsonPropertyName("y")]          public double? Y          { get; init; }
    [JsonPropertyName("width")]      public double? Width      { get; init; }
    [JsonPropertyName("height")]     public double? Height     { get; init; }
    [JsonPropertyName("size")]       public double? Size       { get; init; }
    [JsonPropertyName("align")]      public string? Align      { get; init; }
    [JsonPropertyName("oneLine")]    public bool?   OneLine    { get; init; }
    [JsonPropertyName("manaCost")]   public bool?   ManaCost   { get; init; }
    [JsonPropertyName("allCaps")]    public bool?   AllCaps    { get; init; }
    [JsonPropertyName("bounded")]    public bool?   Bounded    { get; init; }
    [JsonPropertyName("noVerticalCenter")]  public bool?  NoVerticalCenter  { get; init; }
}

/// <summary>A frame layer applied to the card.</summary>
public sealed class CardFrame
{
    [JsonPropertyName("name")]    public string? Name    { get; init; }
    [JsonPropertyName("src")]     public string? Src     { get; init; }
    [JsonPropertyName("noThumb")] public bool?   NoThumb { get; init; }
    [JsonPropertyName("erase")]   public bool?   Erase   { get; init; }
    [JsonPropertyName("opacity")] public double? Opacity { get; init; }
    [JsonPropertyName("masks")]   public List<CardFrameMask>? Masks { get; init; }
    [JsonPropertyName("bounds")]  public CardBounds? Bounds { get; init; }
    [JsonPropertyName("hslHue")]        public double? HslHue        { get; init; }
    [JsonPropertyName("hslSaturation")] public double? HslSaturation { get; init; }
    [JsonPropertyName("hslLightness")]  public double? HslLightness  { get; init; }
    [JsonPropertyName("colorOverlay")]      public string? ColorOverlay      { get; init; }
    [JsonPropertyName("colorOverlayCheck")] public bool?   ColorOverlayCheck { get; init; }
    [JsonPropertyName("preserveAlpha")]     public bool?   PreserveAlpha     { get; init; }
}

/// <summary>A mask applied to a frame layer.</summary>
public sealed class CardFrameMask
{
    [JsonPropertyName("name")] public string? Name { get; init; }
    [JsonPropertyName("src")]  public string? Src  { get; init; }
}

/// <summary>Generic x/y/width/height bounds, all normalised 0–1 relative to card size.</summary>
public sealed class CardBounds
{
    [JsonPropertyName("x")]      public double? X      { get; init; }
    [JsonPropertyName("y")]      public double? Y      { get; init; }
    [JsonPropertyName("width")]  public double? Width  { get; init; }
    [JsonPropertyName("height")] public double? Height { get; init; }
}

/// <summary>Bounds with optional alignment hints used for set symbols.</summary>
public sealed class CardSymbolBounds
{
    [JsonPropertyName("x")]          public double? X          { get; init; }
    [JsonPropertyName("y")]          public double? Y          { get; init; }
    [JsonPropertyName("width")]      public double? Width      { get; init; }
    [JsonPropertyName("height")]     public double? Height     { get; init; }
    [JsonPropertyName("horizontal")] public string? Horizontal { get; init; }
    [JsonPropertyName("vertical")]   public string? Vertical   { get; init; }
}

/// <summary>A simple x/y coordinate pair.</summary>
public sealed class CardPoint
{
    [JsonPropertyName("x")] public double? X { get; init; }
    [JsonPropertyName("y")] public double? Y { get; init; }
}
