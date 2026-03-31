using LlamaMagic.Rendering;
using LlamaMagic.Rendering.Infrastructure;
using Microsoft.Extensions.Caching.Memory;
using Serilog;

namespace RenderTester;

class Program
{
    static async Task Main(string[] args)
    {
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Verbose()
            .WriteTo.Console()
            .CreateLogger();
        
        
        var cache = new MemoryCache(new MemoryCacheOptions());
        var baseDirectory = @"G:\cardconjurer\CardConjurer\";
        var engine = new EngineConfiguration($@"{baseDirectory}wwwroot",
            $@"{baseDirectory}CardConjurer", $@"{baseDirectory}data\uploads",
            @"/user-content", $@"{baseDirectory}wwwroot\local_art");
        
        var svgRasterizationService = new SvgRasterizationService(engine, cache);
        var assetFetcher = new TestingAssetFetcher(engine);
        var llamaRenderService = new LlamaRenderService(engine,assetFetcher, svgRasterizationService);
        
        var cardJson = File.ReadAllText("fern.json");
        var cardData = TestCardData.FromJson(cardJson);
        var sizeProfile = "MPC800";
        var name = cardData.Text.FirstOrDefault(t => t.Key == "title").Value.Text ?? "Unknown";
        var fileName = await RenderCardToFileAsync(llamaRenderService, cardData, name, sizeProfile);


        Log.Information("{name} rendered to {fileName}", name, fileName);


    }

    private static async Task<string> RenderCardToFileAsync(LlamaRenderService llamaRenderService, TestCardData? cardData, string name, string sizeProfile)
    {
        var result = await llamaRenderService.RenderAsync(cardData, false, null, sizeProfile, true);
        var fileName = name + ".png";
        
        //Write bytes from stream out to filename
        await using var fileStream = new FileStream(fileName, FileMode.Create, FileAccess.Write);
        await result.CopyToAsync(fileStream);
        return fileName;
    }
}