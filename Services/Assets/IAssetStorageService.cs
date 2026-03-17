using CardConjurer.Models.Assets;

namespace CardConjurer.Services.Assets;

public interface IAssetStorageService
{
    Task<AssetUploadResult> SaveAsync(string kind, IFormFile file, string? nameHint = null, CancellationToken cancellationToken = default);
}
