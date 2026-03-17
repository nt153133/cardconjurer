using CardConjurer.Models.Assets;
using CardConjurer.Services.Assets;
using Microsoft.Extensions.Options;

namespace CardConjurer.Endpoints;

public static class AssetEndpoints
{
    public static IEndpointRouteBuilder MapAssetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/assets");

        group.MapGet("/sources/{kind}", (string kind, IOptions<AssetStorageOptions> options, IWebHostEnvironment environment) =>
        {
            if (!AssetKinds.IsSupported(kind))
            {
                return Results.BadRequest(new
                {
                    error = "Unsupported kind.",
                    supportedKinds = AssetKinds.Supported.OrderBy(value => value).ToArray()
                });
            }

            var items = BuildUploadedSourceItems(kind, options.Value, environment);
            return Results.Ok(items.OrderBy(item => item.Name, StringComparer.OrdinalIgnoreCase));
        });

        group.MapGet("/art-sources", (IOptions<AssetStorageOptions> options, IWebHostEnvironment environment) =>
        {
            var items = new List<ArtSourceItem>();

            var localArtRoot = Path.Combine(environment.WebRootPath, "local_art");
            if (Directory.Exists(localArtRoot))
            {
                foreach (var filePath in Directory.EnumerateFiles(localArtRoot, "*", SearchOption.AllDirectories))
                {
                    if (!IsImageFile(filePath))
                    {
                        continue;
                    }

                    var relative = Path.GetRelativePath(localArtRoot, filePath).Replace('\\', '/');
                    var displayName = StripHashPrefixFromFileName(Path.GetFileName(relative));
                    items.Add(new ArtSourceItem(
                        Name: displayName,
                        Url: $"/local_art/{relative}",
                        Source: "local_art"));
                }
            }

            items.AddRange(BuildUploadedSourceItems(AssetKinds.Art, options.Value, environment));

            return Results.Ok(items.OrderBy(item => item.Name, StringComparer.OrdinalIgnoreCase));
        });

        group.MapPost("/upload/{kind}", async (string kind, HttpRequest request, IAssetStorageService storage, CancellationToken cancellationToken) =>
        {
            if (!AssetKinds.IsSupported(kind))
            {
                return Results.BadRequest(new
                {
                    error = "Unsupported kind.",
                    supportedKinds = AssetKinds.Supported.OrderBy(value => value).ToArray()
                });
            }

            if (!request.HasFormContentType)
            {
                return Results.BadRequest(new { error = "Expected multipart/form-data." });
            }

            var form = await request.ReadFormAsync(cancellationToken);
            var file = form.Files.GetFile("file");
            if (file is null)
            {
                return Results.BadRequest(new { error = "Missing file field named 'file'." });
            }

            if (file.Length <= 0)
            {
                return Results.BadRequest(new { error = "Empty files are not allowed." });
            }

            var nameHint = form.TryGetValue("nameHint", out var formValue)
                ? formValue.ToString()
                : null;

            try
            {
                var saved = await storage.SaveAsync(kind, file, nameHint, cancellationToken);
                return Results.Ok(saved);
            }
            catch (InvalidOperationException ex) when (string.Equals(kind, AssetKinds.Art, StringComparison.OrdinalIgnoreCase))
            {
                return Results.Conflict(new { error = ex.Message, code = "duplicate_hash" });
            }
        });

        return app;
    }

    private static bool IsImageFile(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        return extension is ".png" or ".jpg" or ".jpeg" or ".webp" or ".bmp" or ".svg" or ".gif";
    }

    private static List<ArtSourceItem> BuildUploadedSourceItems(string kind, AssetStorageOptions options, IWebHostEnvironment environment)
    {
        var items = new List<ArtSourceItem>();
        var uploadsRoot = FileSystemAssetStorageService.ResolveUploadsRoot(options.UploadsRoot, environment.ContentRootPath);
        var publicBasePath = FileSystemAssetStorageService.NormalizePublicBasePath(options.PublicBasePath);
        var kindRoot = Path.Combine(uploadsRoot, kind);
        if (!Directory.Exists(kindRoot))
        {
            return items;
        }

        foreach (var filePath in Directory.EnumerateFiles(kindRoot, "*", SearchOption.AllDirectories))
        {
            if (!IsImageFile(filePath))
            {
                continue;
            }

            var relative = Path.GetRelativePath(uploadsRoot, filePath).Replace('\\', '/');
            var displayName = StripHashPrefixFromFileName(Path.GetFileName(relative));
            items.Add(new ArtSourceItem(
                Name: displayName,
                Url: $"{publicBasePath}/{relative}",
                Source: "uploaded"));
        }

        return items;
    }

    private static string StripHashPrefixFromFileName(string fileName)
    {
        var separatorIndex = fileName.IndexOf('_');
        if (separatorIndex > 0)
        {
            var prefix = fileName[..separatorIndex];
            if (prefix.Length == 64 && prefix.All(IsHexChar))
            {
                return fileName[(separatorIndex + 1)..];
            }
        }

        return fileName;
    }

    private static bool IsHexChar(char c)
    {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }
}
