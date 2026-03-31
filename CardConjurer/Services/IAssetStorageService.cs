using CardConjurer.Models.Assets;

namespace CardConjurer.Services.Assets;

public interface IAssetStorageService
{
    Task<AssetUploadResult> SaveAsync(string kind, IFormFile file, string? nameHint = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a previously uploaded asset by its public URL.
    /// Returns true if the file was found and deleted.
    /// </summary>
    Task<bool> DeleteByUrlAsync(string kind, string publicUrl, CancellationToken cancellationToken = default);
}
