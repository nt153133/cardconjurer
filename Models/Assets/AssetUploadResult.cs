namespace CardConjurer.Models.Assets;

public sealed record AssetUploadResult(
    string Id,
    string Kind,
    string FileName,
    string RelativePath,
    string Url,
    long Size,
    string? ContentType,
    DateTimeOffset CreatedAtUtc);
