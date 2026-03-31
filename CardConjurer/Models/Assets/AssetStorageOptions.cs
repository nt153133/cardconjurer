namespace CardConjurer.Models.Assets;

public sealed class AssetStorageOptions
{
    public string UploadsRoot { get; set; } = "data/uploads";

    public string PublicBasePath { get; set; } = "/user-content";
}
