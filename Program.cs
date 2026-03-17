using CardConjurer.Endpoints;
using CardConjurer.Services.ImportNormalization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddSingleton<ICardImportNormalizationService, CardImportNormalizationService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseStaticFiles();

app.UseRouting();

app.MapRazorPages();
app.MapImportNormalizationEndpoints();

app.Run();
