using System.Net.Http.Headers;
using CardConjurer.Models.Assets;
using CardConjurer.Services.Assets;
using LlamaMagic.Rendering.Infrastructure;
using Microsoft.Extensions.Options;

namespace CardConjurer.Services.CardImage;

/// <summary>
/// Web-project implementation of <see cref="IAssetFetcher"/> that bridges the rendering
/// engine's abstraction with ASP.NET Core's IHttpClientFactory and local file resolution.
/// </summary>
public sealed class WebAssetFetcher : IAssetFetcher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly EngineConfiguration _engineConfig;

    public WebAssetFetcher(
        IHttpClientFactory httpClientFactory,
        EngineConfiguration engineConfig)
    {
        _httpClientFactory = httpClientFactory;
        _engineConfig = engineConfig;
    }

    public async Task<Stream?> FetchAssetStreamAsync(string source, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(source)) return null;

        // HTTP/HTTPS URLs → fetch via HttpClient
        if (Uri.TryCreate(source, UriKind.Absolute, out var absoluteUri)
            && (absoluteUri.Scheme == Uri.UriSchemeHttp || absoluteUri.Scheme == Uri.UriSchemeHttps))
        {
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(12);
            httpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("CardConjurer", "1.0"));

            try
            {
                // Copy to MemoryStream so the HttpClient response can be disposed
                var responseStream = await httpClient.GetStreamAsync(absoluteUri, cancellationToken);
                var ms = new MemoryStream();
                await responseStream.CopyToAsync(ms, cancellationToken);
                ms.Seek(0, SeekOrigin.Begin);
                return ms;
            }
            catch
            {
                return null;
            }
        }

        // Local path resolution
        var localPath = ResolveLocalPath(source);
        if (localPath is null || !File.Exists(localPath)) return null;

        // Copy to MemoryStream so the caller doesn't hold the file lock
        var fileMs = new MemoryStream();
        await using var fileStream = File.OpenRead(localPath);
        await fileStream.CopyToAsync(fileMs, cancellationToken);
        fileMs.Seek(0, SeekOrigin.Begin);
        return fileMs;
    }

    private string? ResolveLocalPath(string source)
    {
        var normalized = source.Trim();

        // Strip any absolute localhost origin
        if (normalized.StartsWith("http://localhost", StringComparison.OrdinalIgnoreCase)
            || normalized.StartsWith("https://localhost", StringComparison.OrdinalIgnoreCase))
        {
            var slashAfterHost = normalized.IndexOf('/', normalized.IndexOf("://") + 3);
            normalized = slashAfterHost >= 0 ? normalized[slashAfterHost..] : "/";
        }

        if (normalized.StartsWith("/"))
        {
            if (normalized.StartsWith(_engineConfig.PublicUploadsBasePath + "/", StringComparison.OrdinalIgnoreCase))
            {
                var relative = normalized[_engineConfig.PublicUploadsBasePath.Length..].TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                return EnsureInsideRoot(_engineConfig.UploadsRoot, relative);
            }

            if (normalized.StartsWith("/img/", StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith("/js/", StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith("/css/", StringComparison.OrdinalIgnoreCase)
                || normalized.StartsWith("/local_art/", StringComparison.OrdinalIgnoreCase))
            {
                var relative = normalized.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                return EnsureInsideRoot(_engineConfig.WebRootPath, relative);
            }
        }

        if (!normalized.Contains('/') && !normalized.Contains('\\'))
            return EnsureInsideRoot(_engineConfig.LocalArtRoot, normalized);

        return null;
    }

    private static string? EnsureInsideRoot(string root, string relative)
    {
        if (string.IsNullOrWhiteSpace(root)) return null;

        var fullRoot = Path.GetFullPath(root);
        var fullPath = Path.GetFullPath(Path.Combine(fullRoot, relative));

        return fullPath.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase) ? fullPath : null;
    }
}

