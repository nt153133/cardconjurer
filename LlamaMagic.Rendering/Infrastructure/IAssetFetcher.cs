namespace LlamaMagic.Rendering.Infrastructure;

/// <summary>
/// Abstraction for fetching asset streams (images, SVGs, etc.) from various sources.
/// Replaces the direct IHttpClientFactory / local path resolution in the web project.
/// </summary>
public interface IAssetFetcher
{
    /// <summary>
    /// Fetches an asset as a readable stream from the given source URI or path.
    /// Implementations should handle HTTP URLs, root-relative paths, and local file names.
    /// </summary>
    /// <param name="source">The asset source (URL, root-relative path, or local filename).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A readable stream, or null if the asset cannot be resolved.</returns>
    Task<Stream?> FetchAssetStreamAsync(string source, CancellationToken cancellationToken = default);
}

