using System.Text.RegularExpressions;
using CardConjurer.Models.ImportNormalization;

namespace CardConjurer.Services.ImportNormalization;

public sealed class CardImportNormalizationService : ICardImportNormalizationService
{
    public ParsedCardFromTextResult ParseCardFromText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new ParsedCardFromTextResult();
        }

        var lines = text
            .Trim()
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        if (lines.Count == 0)
        {
            return new ParsedCardFromTextResult();
        }

        var nameLine = lines[0];
        lines.RemoveAt(0);

        string? manaCost = null;
        var manaCostStart = nameLine.IndexOf('{');
        if (manaCostStart > 0)
        {
            manaCost = nameLine[manaCostStart..].Trim();
            nameLine = nameLine[..manaCostStart].Trim();
        }

        var result = new ParsedCardFromTextResult
        {
            Name = nameLine,
            ManaCost = manaCost
        };

        if (lines.Count == 0)
        {
            return result;
        }

        var typeLine = lines[0].Trim();
        lines.RemoveAt(0);
        result = result with { TypeLine = typeLine };

        if (lines.Count == 0)
        {
            return result;
        }

        var ptMatch = Regex.Match(lines[^1], @"[0-9+\-*]+/[0-9+*]+");
        if (ptMatch.Success)
        {
            var pt = ptMatch.Value.Split('/');
            result = result with
            {
                Power = pt.ElementAtOrDefault(0),
                Toughness = pt.ElementAtOrDefault(1)
            };
            lines.RemoveAt(lines.Count - 1);
        }

        if (lines.Count == 0)
        {
            return result;
        }

        return result with { OracleText = string.Join("\n", lines) };
    }

    public List<SagaAbilityDto> ParseSagaAbilities(string text)
    {
        var stepsMap = new Dictionary<string, string>(StringComparer.Ordinal);
        var abilityText = Regex.Replace(text ?? string.Empty, @"^\(.*?\)\s*", string.Empty);

        var regex = new Regex(@"([IVX, ]+)\s+—\s+([\s\S]+?)(?=(?:\n[IVX, ]+\s+—|$))", RegexOptions.Multiline);
        foreach (Match match in regex.Matches(abilityText))
        {
            var stepsRaw = match.Groups[1].Value.Split(',').Select(step => step.Trim());
            var ability = match.Groups[2].Value.Trim();

            foreach (var step in stepsRaw)
            {
                if (!string.IsNullOrWhiteSpace(step))
                {
                    stepsMap[step] = ability;
                }
            }
        }

        var loreOrder = Enumerable.Range(1, 24).Select(ToRomanNumeral).ToList();
        var ordered = new List<SagaAbilityDto>();
        var indexByAbility = new Dictionary<string, int>(StringComparer.Ordinal);

        foreach (var step in loreOrder)
        {
            if (!stepsMap.TryGetValue(step, out var ability))
            {
                continue;
            }

            if (indexByAbility.TryGetValue(ability, out var existingIndex))
            {
                ordered[existingIndex] = ordered[existingIndex] with { Steps = ordered[existingIndex].Steps + 1 };
            }
            else
            {
                ordered.Add(new SagaAbilityDto(ability, 1));
                indexByAbility[ability] = ordered.Count - 1;
            }
        }

        return ordered;
    }

    public string? ExtractSagaReminderText(string text)
    {
        var match = Regex.Match(text ?? string.Empty, @"^\([^)]*\)");
        return match.Success ? match.Value : null;
    }

    public List<ClassAbilityDto> ParseClassAbilities(string text)
    {
        var lines = (text ?? string.Empty).Split('\n').ToList();
        var abilities = new List<ClassAbilityDto>();

        string reminderText = string.Empty;
        if (lines.Count > 0 && lines[0].StartsWith('('))
        {
            reminderText = lines[0];
            lines.RemoveAt(0);
        }

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i].Trim();
            var levelMatch = Regex.Match(line, @"^(\{.*?\}):\s*Level \d+");
            if (levelMatch.Success)
            {
                var cost = $"{levelMatch.Groups[1].Value}:";
                var ability = i + 1 < lines.Count ? lines[i + 1].Trim() : string.Empty;
                abilities.Add(new ClassAbilityDto(cost, ability));
                i++;
            }
            else if (abilities.Count == 0)
            {
                abilities.Add(new ClassAbilityDto(string.Empty, line));
            }
        }

        if (!string.IsNullOrWhiteSpace(reminderText) && abilities.Count > 0)
        {
            var first = abilities[0];
            abilities[0] = first with { Ability = $"{reminderText}{{lns}}{{bar}}{{lns}}{first.Ability}" };
        }

        return abilities;
    }

    public string? ParseRollAbilities(string text)
    {
        if (string.IsNullOrWhiteSpace(text) || !text.Contains("roll a d20", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var modified = text;
        var lines = text.Split('\n');

        for (var i = 1; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            var match = Regex.Match(line, @"^(\d+(?:—\d+)?)\s*\|\s*(.+)$");
            if (!match.Success)
            {
                continue;
            }

            var replacement = $"{{roll{match.Groups[1].Value}}} {match.Groups[2].Value}";
            modified = modified.Replace(line, replacement, StringComparison.Ordinal);
        }

        return modified;
    }

    public StationParseResult? ParseStationCard(string oracleText)
    {
        if (string.IsNullOrWhiteSpace(oracleText) || !oracleText.Contains("Station", StringComparison.Ordinal))
        {
            return null;
        }

        var parts = Regex.Split(oracleText, @"STATION \d+\+");
        var preStationText = (parts.Length > 0 ? parts[0] : string.Empty).Trim();
        preStationText = Regex.Replace(preStationText, @"Station (\([^)]+\))", "Station {i}$1{/i}");

        var stationAbilities = new List<StationAbilityDto>();
        var stationRegex = new Regex(@"(\d+\+)\s*\|\s*([^\n]+)");
        foreach (Match match in stationRegex.Matches(oracleText))
        {
            stationAbilities.Add(new StationAbilityDto(match.Groups[1].Value, match.Groups[2].Value.Trim()));
        }

        return new StationParseResult(preStationText, stationAbilities);
    }

    public MultiFacedParseResult? ParseMultiFacedCards(ScryfallCardDto card, IReadOnlyList<ScryfallCardDto>? contextCards = null)
    {
        ScryfallCardFaceDto? frontFace = card.CardFaces?.ElementAtOrDefault(0);
        ScryfallCardFaceDto? backFace = card.CardFaces?.ElementAtOrDefault(1);

        if (string.Equals(card.ObjectType, "card_face", StringComparison.Ordinal))
        {
            frontFace = new ScryfallCardFaceDto
            {
                ObjectType = card.ObjectType,
                Name = card.Name,
                TypeLine = card.TypeLine,
                OracleText = card.OracleText,
                ManaCost = card.ManaCost,
                Power = card.Power,
                Toughness = card.Toughness,
                Defense = card.Defense,
                FlavorText = card.FlavorText,
                ImageUris = card.ImageUris
            };

            var back = contextCards?
                .FirstOrDefault(face =>
                    string.Equals(face.ObjectType, "card_face", StringComparison.Ordinal) &&
                    !string.Equals(face.Name, card.Name, StringComparison.Ordinal));

            if (back is not null)
            {
                backFace = new ScryfallCardFaceDto
                {
                    ObjectType = back.ObjectType,
                    Name = back.Name,
                    TypeLine = back.TypeLine,
                    OracleText = back.OracleText,
                    ManaCost = back.ManaCost,
                    Power = back.Power,
                    Toughness = back.Toughness,
                    Defense = back.Defense,
                    FlavorText = back.FlavorText,
                    ImageUris = back.ImageUris
                };
            }
        }

        if (frontFace is null || backFace is null)
        {
            return null;
        }

        return new MultiFacedParseResult(MapFace(frontFace), MapFace(backFace));
    }

    public LevelerParseResult? ParseLevelerCard(ScryfallCardDto card)
    {
        if (!string.Equals(card.Layout, "leveler", StringComparison.Ordinal) || string.IsNullOrWhiteSpace(card.OracleText))
        {
            return null;
        }

        var sections = card.OracleText.Split('\n');
        var levelUpMatch = Regex.Match(sections[0], @"Level up (.+?) \((.+?)\)");

        var levelUpCost = levelUpMatch.Success ? levelUpMatch.Groups[1].Value : string.Empty;
        var levelUpReminder = levelUpMatch.Success ? levelUpMatch.Groups[2].Value : string.Empty;

        var levelSections = new List<(string Range, List<string> Content)>();
        (string Range, List<string> Content)? currentSection = null;

        for (var i = 1; i < sections.Length; i++)
        {
            var line = sections[i];
            var levelMatch = Regex.Match(line, @"^LEVEL (.+)$");
            if (levelMatch.Success)
            {
                if (currentSection is not null)
                {
                    levelSections.Add(currentSection.Value);
                }

                currentSection = (levelMatch.Groups[1].Value, new List<string>());
            }
            else if (currentSection is not null && !string.IsNullOrWhiteSpace(line))
            {
                currentSection.Value.Content.Add(line);
            }
        }

        if (currentSection is not null)
        {
            levelSections.Add(currentSection.Value);
        }

        var parsedLevels = new List<LevelerLevelDto>();
        foreach (var levelSection in levelSections)
        {
            var pt = levelSection.Content.FirstOrDefault(line => Regex.IsMatch(line.Trim(), @"^\d+/\d+$"));
            var abilities = pt is null
                ? levelSection.Content
                : levelSection.Content.Where(line => !string.Equals(line.Trim(), pt.Trim(), StringComparison.Ordinal)).ToList();

            parsedLevels.Add(new LevelerLevelDto(
                levelSection.Range,
                pt?.Trim() ?? string.Empty,
                abilities,
                string.Join("\n", abilities)));
        }

        var basePt = !string.IsNullOrWhiteSpace(card.Power) && !string.IsNullOrWhiteSpace(card.Toughness)
            ? $"{card.Power}/{card.Toughness}"
            : string.Empty;

        return new LevelerParseResult(
            Layout: "leveler",
            Name: card.Name ?? string.Empty,
            Type: card.TypeLine ?? string.Empty,
            Mana: card.ManaCost ?? string.Empty,
            BasePt: basePt,
            LevelUpCost: levelUpCost,
            LevelUpText: $"Level up {levelUpCost} {{i}}({levelUpReminder}){{/i}}",
            Levels: parsedLevels);
    }

    public PrototypeParseResult? ParsePrototypeLayout(ScryfallCardDto card)
    {
        if (!string.Equals(card.Layout, "prototype", StringComparison.Ordinal) || string.IsNullOrWhiteSpace(card.OracleText))
        {
            return null;
        }

        var match = Regex.Match(card.OracleText, @"^Prototype (.+?) — (\d+)/(\d+) \((.+?)\)");
        if (!match.Success)
        {
            return null;
        }

        var lines = card.OracleText.Split('\n');
        var mainRules = string.Join("\n", lines.Skip(1)).Trim();
        var basePt = !string.IsNullOrWhiteSpace(card.Power) && !string.IsNullOrWhiteSpace(card.Toughness)
            ? $"{card.Power}/{card.Toughness}"
            : string.Empty;

        var prototype = new PrototypeData(
            match.Groups[1].Value,
            $"{match.Groups[2].Value}/{match.Groups[3].Value}",
            $"Prototype {match.Groups[1].Value} — {match.Groups[2].Value}/{match.Groups[3].Value} {{i}}({match.Groups[4].Value}){{/i}}");

        return new PrototypeParseResult(
            Layout: "prototype",
            Name: card.Name ?? string.Empty,
            Type: card.TypeLine ?? string.Empty,
            Mana: card.ManaCost ?? string.Empty,
            BasePt: basePt,
            Rules: mainRules,
            Prototype: prototype);
    }

    public MutateParseResult? ParseMutateLayout(ScryfallCardDto card)
    {
        if (!string.Equals(card.Layout, "mutate", StringComparison.Ordinal) || string.IsNullOrWhiteSpace(card.OracleText))
        {
            return null;
        }

        var match = Regex.Match(card.OracleText, @"^Mutate (.+?) \((.+?)\)");
        if (!match.Success)
        {
            return null;
        }

        var lines = card.OracleText.Split('\n');
        var mainRules = string.Join("\n", lines.Skip(1)).Trim();
        var basePt = !string.IsNullOrWhiteSpace(card.Power) && !string.IsNullOrWhiteSpace(card.Toughness)
            ? $"{card.Power}/{card.Toughness}"
            : string.Empty;

        return new MutateParseResult(
            Layout: "mutate",
            Name: card.Name ?? string.Empty,
            Type: card.TypeLine ?? string.Empty,
            Mana: card.ManaCost ?? string.Empty,
            BasePt: basePt,
            Rules: mainRules,
            Mutate: new MutateData(match.Groups[1].Value, $"Mutate {match.Groups[1].Value} {{i}}({match.Groups[2].Value}){{/i}}"));
    }

    public VanguardParseResult? ParseVanguardLayout(ScryfallCardDto card)
    {
        if (!string.Equals(card.Layout, "vanguard", StringComparison.Ordinal) || string.IsNullOrWhiteSpace(card.OracleText))
        {
            return null;
        }

        return new VanguardParseResult(
            Layout: "vanguard",
            Name: card.Name ?? string.Empty,
            Type: card.TypeLine ?? string.Empty,
            Rules: card.OracleText ?? string.Empty,
            Flavor: card.FlavorText ?? string.Empty,
            HandModifier: card.HandModifier ?? string.Empty,
            LifeModifier: card.LifeModifier ?? string.Empty);
    }

    public List<ScryfallCardDto> ProcessScryfallCard(ScryfallCardDto card)
    {
        var responseCards = new List<ScryfallCardDto>();
        var hasFaces = card.CardFaces is { Count: > 0 };

        if (hasFaces)
        {
            foreach (var face in card.CardFaces!)
            {
                var normalizedFace = new ScryfallCardDto
                {
                    ObjectType = face.ObjectType,
                    Name = face.Name,
                    TypeLine = face.TypeLine,
                    OracleText = face.OracleText,
                    ManaCost = face.ManaCost,
                    Power = face.Power,
                    Toughness = face.Toughness,
                    Defense = face.Defense,
                    FlavorText = face.FlavorText,
                    Set = card.Set,
                    Rarity = card.Rarity,
                    CollectorNumber = card.CollectorNumber,
                    Lang = card.Lang,
                    Layout = card.Layout,
                    ImageUris = face.ImageUris ?? card.ImageUris
                };

                if (!string.Equals(card.Lang, "en", StringComparison.Ordinal) || !string.IsNullOrWhiteSpace(face.PrintedName))
                {
                    normalizedFace = normalizedFace with
                    {
                        OracleText = face.PrintedText ?? normalizedFace.OracleText,
                        Name = face.PrintedName ?? normalizedFace.Name,
                        TypeLine = face.PrintedTypeLine ?? normalizedFace.TypeLine
                    };
                }

                responseCards.Add(normalizedFace);
            }

            return responseCards;
        }

        var single = card;
        if (!string.Equals(card.Lang, "en", StringComparison.Ordinal) || !string.IsNullOrWhiteSpace(card.PrintedName))
        {
            single = single with
            {
                OracleText = card.PrintedText ?? card.OracleText,
                Name = card.PrintedName ?? card.Name,
                TypeLine = card.PrintedTypeLine ?? card.TypeLine
            };
        }

        if (string.IsNullOrWhiteSpace(single.Layout))
        {
            single = single with { Layout = "normal" };
        }

        responseCards.Add(single);
        return responseCards;
    }

    private static ParsedFaceData MapFace(ScryfallCardFaceDto face)
    {
        var pt = !string.IsNullOrWhiteSpace(face.Power)
            ? $"{face.Power}/{face.Toughness}"
            : string.Empty;

        return new ParsedFaceData(
            Name: face.Name ?? string.Empty,
            Type: face.TypeLine ?? string.Empty,
            Rules: face.OracleText ?? string.Empty,
            Mana: face.ManaCost ?? string.Empty,
            Pt: pt,
            Defense: face.Defense ?? string.Empty,
            Flavor: face.FlavorText ?? string.Empty);
    }

    private static string ToRomanNumeral(int number)
    {
        var map = new[]
        {
            (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"),
            (100, "C"), (90, "XC"), (50, "L"), (40, "XL"),
            (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")
        };

        var remainder = number;
        var result = string.Empty;

        foreach (var (value, symbol) in map)
        {
            while (remainder >= value)
            {
                result += symbol;
                remainder -= value;
            }
        }

        return result;
    }
}
