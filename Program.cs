using CardConjurer.Models.Assets;
using CardConjurer.Models.Cards;
using CardConjurer.Services.Assets;
using CardConjurer.Endpoints;
using CardConjurer.Services.Cards;
using CardConjurer.Services.CardImage;
using CardConjurer.Services.ImportNormalization;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddSingleton<ICardImportNormalizationService, CardImportNormalizationService>();
builder.Services.Configure<AssetStorageOptions>(builder.Configuration.GetSection("Storage"));
builder.Services.AddSingleton<IAssetStorageService, FileSystemAssetStorageService>();
builder.Services.Configure<CardStorageOptions>(builder.Configuration.GetSection("Cards"));
builder.Services.AddSingleton<ICardStorageService, FileSystemCardStorageService>();
builder.Services.AddSingleton<ICardImageService, CardImageService>();

var app = builder.Build();

var assetStorageOptions = app.Services.GetRequiredService<IOptions<AssetStorageOptions>>().Value;
var uploadsRoot = FileSystemAssetStorageService.ResolveUploadsRoot(assetStorageOptions.UploadsRoot, app.Environment.ContentRootPath);
var publicUploadsBasePath = FileSystemAssetStorageService.NormalizePublicBasePath(assetStorageOptions.PublicBasePath);

Directory.CreateDirectory(uploadsRoot);
foreach (var kind in AssetKinds.Supported)
{
    Directory.CreateDirectory(Path.Combine(uploadsRoot, kind));
}

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseStaticFiles();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsRoot),
    RequestPath = publicUploadsBasePath
});

app.UseRouting();

app.MapRazorPages();
app.MapImportNormalizationEndpoints();
app.MapAssetEndpoints();
app.MapCardEndpoints();
app.MapCardImageEndpoints();

app.Run();