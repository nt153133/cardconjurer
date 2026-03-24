using CardConjurer.Models.Assets;
using CardConjurer.Models.Cards;
using CardConjurer.Services.Assets;
using CardConjurer.Endpoints;
using CardConjurer.Services.Cards;
using CardConjurer.Services.CardImage;
using CardConjurer.Services.ImportNormalization;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting CardConjurer");

    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, services, configuration) => configuration
        .WriteTo.Console()
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    builder.Services.AddRazorPages();
    builder.Services.AddSingleton<ICardImportNormalizationService, CardImportNormalizationService>();
    builder.Services.Configure<AssetStorageOptions>(builder.Configuration.GetSection("Storage"));
    builder.Services.AddSingleton<IAssetStorageService, FileSystemAssetStorageService>();
    builder.Services.Configure<CardStorageOptions>(builder.Configuration.GetSection("Cards"));
    builder.Services.AddSingleton<ICardStorageService, FileSystemCardStorageService>();
    builder.Services.AddSingleton<ICardImageService, CardImageService>();
    builder.Services.AddHttpClient();
    builder.Services.AddMemoryCache();
    builder.Services.AddSingleton<ISvgRasterizationService, SvgRasterizationService>();
    builder.Services.AddSingleton<ICardRenderV2Service, CardRenderV2Service>();

    var app = builder.Build();

    var assetStorageOptions = app.Services.GetRequiredService<IOptions<AssetStorageOptions>>().Value;
    var uploadsRoot = FileSystemAssetStorageService.ResolveUploadsRoot(assetStorageOptions.UploadsRoot, app.Environment.ContentRootPath);
    var publicUploadsBasePath = FileSystemAssetStorageService.NormalizePublicBasePath(assetStorageOptions.PublicBasePath);

    Directory.CreateDirectory(uploadsRoot);
    foreach (var kind in AssetKinds.Supported)
    {
        Directory.CreateDirectory(Path.Combine(uploadsRoot, kind));
    }

    Log.Information("Using uploads root {UploadsRoot} and public path {PublicUploadsBasePath}", uploadsRoot, publicUploadsBasePath);

    if (!app.Environment.IsDevelopment())
    {
        app.UseExceptionHandler("/Error");
    }

    // wwwroot/ is the canonical static-file root (served by default).
    app.UseStaticFiles();

    // gallery/ is preserved at the project root and served at /gallery.
    var galleryPath = Path.Combine(app.Environment.ContentRootPath, "gallery");
    if (Directory.Exists(galleryPath))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(galleryPath),
            RequestPath = "/gallery"
        });
    }

    // User-uploaded assets.
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(uploadsRoot),
        RequestPath = publicUploadsBasePath
    });

    app.UseSerilogRequestLogging();

    app.UseRouting();

    app.MapRazorPages();
    app.MapImportNormalizationEndpoints();
    app.MapAssetEndpoints();
    app.MapCardEndpoints();
    app.MapCardImageEndpoints();
    app.MapRenderV2Endpoints();

    Log.Information("CardConjurer started successfully");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "CardConjurer terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}