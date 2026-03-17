using CardConjurer.Models.Assets;
using Microsoft.Extensions.Options;
using System.Security.Cryptography;
using System.Text;

namespace CardConjurer.Services.Assets;

public sealed class FileSystemAssetStorageService : IAssetStorageService
{
    private readonly string _uploadsRoot;
    private readonly string _publicBasePath;
    private readonly HashSet<string> _artHashes = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _artHashesLock = new();

    public FileSystemAssetStorageService(IOptions<AssetStorageOptions> options, IWebHostEnvironment environment)
    {
        var storage = options.Value;
        _uploadsRoot = ResolveUploadsRoot(storage.UploadsRoot, environment.ContentRootPath);
        _publicBasePath = NormalizePublicBasePath(storage.PublicBasePath);
        LoadExistingArtHashes();
    }

    public async Task<AssetUploadResult> SaveAsync(string kind, IFormFile file, string? nameHint = null, CancellationToken cancellationToken = default)
    {
        if (!AssetKinds.IsSupported(kind))
        {
            throw new ArgumentException("Unsupported asset kind.", nameof(kind));
        }

        if (file.Length <= 0)
        {
            throw new ArgumentException("File is empty.", nameof(file));
        }

        var normalizedKind = kind.Trim().ToLowerInvariant();
        var createdAtUtc = DateTimeOffset.UtcNow;
        var dateSegment = Path.Combine(
            createdAtUtc.Year.ToString("D4"),
            createdAtUtc.Month.ToString("D2"),
            createdAtUtc.Day.ToString("D2"));

        var sourceName = !string.IsNullOrWhiteSpace(nameHint) ? nameHint : file.FileName;
        var safeOriginalName = MakeSafeFileName(sourceName);
        string id;
        string storedFileName;

        if (string.Equals(normalizedKind, AssetKinds.Art, StringComparison.Ordinal))
        {
            id = await ComputeSha256HexAsync(file, cancellationToken);

            lock (_artHashesLock)
            {
                if (_artHashes.Contains(id))
                {
                    throw new InvalidOperationException("Duplicate art upload: matching file hash already exists.");
                }
            }

            storedFileName = BuildHashedArtFileName(id, safeOriginalName);
        }
        else
        {
            id = Guid.NewGuid().ToString("N");
            storedFileName = $"{id}-{safeOriginalName}";
        }

        var targetDirectory = Path.Combine(_uploadsRoot, normalizedKind, dateSegment);
        Directory.CreateDirectory(targetDirectory);

        var fullPath = Path.Combine(targetDirectory, storedFileName);
        await using (var stream = File.Create(fullPath))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        if (string.Equals(normalizedKind, AssetKinds.Art, StringComparison.Ordinal))
        {
            lock (_artHashesLock)
            {
                _artHashes.Add(id);
            }
        }

        var relativePath = Path.Combine(normalizedKind, dateSegment, storedFileName).Replace('\\', '/');
        var url = $"{_publicBasePath}/{relativePath}";

        return new AssetUploadResult(
            Id: id,
            Kind: normalizedKind,
            FileName: storedFileName,
            RelativePath: relativePath,
            Url: url,
            Size: file.Length,
            ContentType: file.ContentType,
            CreatedAtUtc: createdAtUtc);
    }

    private void LoadExistingArtHashes()
    {
        var artRoot = Path.Combine(_uploadsRoot, AssetKinds.Art);
        if (!Directory.Exists(artRoot))
        {
            return;
        }

        foreach (var filePath in Directory.EnumerateFiles(artRoot, "*", SearchOption.AllDirectories))
        {
            try
            {
                var fileName = Path.GetFileName(filePath);
                var hashFromName = TryReadHashPrefix(fileName);
                var hash = hashFromName ?? ComputeSha256HexFromPath(filePath);
                if (!string.IsNullOrWhiteSpace(hash))
                {
                    lock (_artHashesLock)
                    {
                        _artHashes.Add(hash);
                    }
                }
            }
            catch
            {
                // Ignore single-file hash read failures and continue indexing.
            }
        }
    }

    private static string BuildHashedArtFileName(string hash, string safeOriginalName)
    {
        var extension = Path.GetExtension(safeOriginalName);
        if (string.IsNullOrWhiteSpace(extension))
        {
            extension = ".bin";
        }

        var baseName = Path.GetFileNameWithoutExtension(safeOriginalName);
        if (string.IsNullOrWhiteSpace(baseName))
        {
            baseName = "upload";
        }

        return $"{hash}_{baseName}{extension}";
    }

    private static string? TryReadHashPrefix(string fileName)
    {
        var separatorIndex = fileName.IndexOf('_');
        if (separatorIndex <= 0)
        {
            return null;
        }

        var prefix = fileName[..separatorIndex];
        if (prefix.Length != 64)
        {
            return null;
        }

        return prefix.All(IsHexChar) ? prefix.ToLowerInvariant() : null;
    }

    private static bool IsHexChar(char c)
    {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }

    private static async Task<string> ComputeSha256HexAsync(IFormFile file, CancellationToken cancellationToken)
    {
        await using var stream = file.OpenReadStream();
        using var sha = SHA256.Create();
        var hash = await sha.ComputeHashAsync(stream, cancellationToken);
        return ConvertToHex(hash);
    }

    private static string ComputeSha256HexFromPath(string filePath)
    {
        using var stream = File.OpenRead(filePath);
        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(stream);
        return ConvertToHex(hash);
    }

    private static string ConvertToHex(byte[] hash)
    {
        var sb = new StringBuilder(hash.Length * 2);
        foreach (var b in hash)
        {
            sb.Append(b.ToString("x2"));
        }

        return sb.ToString();
    }

    public static string ResolveUploadsRoot(string configuredPath, string contentRootPath)
    {
        if (string.IsNullOrWhiteSpace(configuredPath))
        {
            configuredPath = "data/uploads";
        }

        return Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.GetFullPath(Path.Combine(contentRootPath, configuredPath));
    }

    public static string NormalizePublicBasePath(string? publicBasePath)
    {
        if (string.IsNullOrWhiteSpace(publicBasePath))
        {
            return "/user-content";
        }

        var normalized = publicBasePath.Trim();
        if (!normalized.StartsWith('/'))
        {
            normalized = "/" + normalized;
        }

        return normalized.TrimEnd('/');
    }

    private static string MakeSafeFileName(string? input)
    {
        var candidate = Path.GetFileName(input ?? string.Empty);
        if (string.IsNullOrWhiteSpace(candidate))
        {
            candidate = "upload.bin";
        }

        foreach (var invalid in Path.GetInvalidFileNameChars())
        {
            candidate = candidate.Replace(invalid, '_');
        }

        candidate = candidate.Replace("..", "_").Trim();

        return string.IsNullOrWhiteSpace(candidate) ? "upload.bin" : candidate;
    }
}
