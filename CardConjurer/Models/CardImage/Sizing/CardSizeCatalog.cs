using SixLabors.ImageSharp;

namespace CardConjurer.Models.CardImage.Sizing;

/// <summary>
/// Central registry of card-size profiles used by settings and rendering flows.
/// </summary>
public static class CardSizeCatalog
{
    /// <summary>
    /// Read-only list of predefined profiles sorted by cut area.
    /// </summary>
    public static IReadOnlyList<CardSizeProfile> Profiles { get; } =
        new List<CardSizeProfile>
        {
            new("MPC300", new Size(744, 1038), new Size(816, 1110), new Size(684, 981), dpi: 300),
            new("MTG_Web", new Size(744, 1039), new Size(816, 1111), new Size(684, 981), dpi: 300),
            new("MPC800", new Size(1984, 2768), new Size(2176, 2960), new Size(1834, 2622), dpi: 800),
            new("MPC8002", new Size(1984, 2770), new Size(2176, 2960), new Size(1834, 2622), dpi: 800),
            CardSizeProfile.StandardCard(600),
            CardSizeProfile.StandardCard(800),
            CardSizeProfile.StandardCard(1200),
            new("CardConjurer Default", new Size(2010, 2814), new Size(2187, 2975), new Size(1834, 2622), dpi: 804),
        }
        .OrderBy(p => p.CutSize.Width * p.CutSize.Height)
        .ToList();

    /// <summary>
    /// Backward-compatible alias for existing callsites.
    /// </summary>
    public static IEnumerable<CardSizeProfile> PredefinedCardSizes => Profiles;

    /// <summary>
    /// Profile names for dropdown controls.
    /// </summary>
    public static IReadOnlyList<string> ProfileNames { get; } = Profiles.Select(p => p.Name).ToList();

    /// <summary>
    /// Default profile for first-time selection.
    /// </summary>
    public static CardSizeProfile DefaultProfile { get; } =
        Profiles.FirstOrDefault(p => string.Equals(p.Name, "MPC800", StringComparison.OrdinalIgnoreCase))
        ?? Profiles[0];

    /// <summary>
    /// Gets a profile by name, falling back to <see cref="DefaultProfile"/> if not found.
    /// </summary>
    public static CardSizeProfile GetByNameOrDefault(string? name)
        => TryGetByName(name, out var profile) ? profile : DefaultProfile;

    /// <summary>
    /// Attempts to get a profile by name.
    /// </summary>
    public static bool TryGetByName(string? name, out CardSizeProfile profile)
    {
        profile = Profiles.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase))
                  ?? DefaultProfile;

        return !string.IsNullOrWhiteSpace(name)
               && string.Equals(profile.Name, name, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Gets the profile whose cut dimensions are closest to the provided card cut size.
    /// </summary>
    public static CardSizeProfile GetClosestByCutSize(int width, int height)
    {
        if (width <= 0 || height <= 0)
        {
            return DefaultProfile;
        }

        CardSizeProfile? best = null;
        double bestScore = double.MaxValue;

        foreach (var profile in Profiles)
        {
            var dx = profile.CutSize.Width - width;
            var dy = profile.CutSize.Height - height;
            var distance = (dx * dx) + (dy * dy);

            var profileAspect = profile.CutSize.Width / (double)profile.CutSize.Height;
            var cardAspect = width / (double)height;
            var aspectPenalty = Math.Abs(profileAspect - cardAspect) * 1_000_000d;
            var score = distance + aspectPenalty;

            if (score < bestScore)
            {
                bestScore = score;
                best = profile;
            }
        }

        return best ?? DefaultProfile;
    }
}