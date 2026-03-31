namespace LlamaMagic.Rendering.Infrastructure;

/// <summary>
/// Configuration record that replaces IWebHostEnvironment for the rendering engine.
/// Provides the directory paths required by the engine without coupling to ASP.NET Core hosting.
/// </summary>
/// <param name="WebRootPath">Absolute path to the web root directory (wwwroot).</param>
/// <param name="ContentRootPath">Absolute path to the application content root directory.</param>
/// <param name="UploadsRoot">Absolute path to the user-uploaded assets directory.</param>
/// <param name="PublicUploadsBasePath">URL base path for user-uploaded assets (e.g. "/user-content").</param>
/// <param name="LocalArtRoot">Absolute path to the local art directory.</param>
public record EngineConfiguration(
    string WebRootPath,
    string ContentRootPath,
    string UploadsRoot,
    string PublicUploadsBasePath,
    string LocalArtRoot);

