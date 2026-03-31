using CardConjurer.Models.CardImage;
using SixLabors.ImageSharp;

namespace CardConjurer.Services.CardImage;

public static class Tokenizer
{
    public abstract record TextToken;

// Represents a printable word
    public sealed record WordToken(string Text) : TextToken;

// Represents a space character (advances the X coordinate)
    public sealed record SpaceToken() : TextToken;

// Represents a control tag like {i}, {line}, or {fontsize-4}
    public sealed record TagToken(string Code) : TextToken;

    public static List<TextToken> TokenizeText(string rawText, CardData card)
    {
        if (string.IsNullOrWhiteSpace(rawText))
            return new List<TextToken>();

        var text = rawText;

        // 1. Conditional Replacements
        var cardName = !string.IsNullOrWhiteSpace(card.GetTitle()) ? card.GetTitle() : "Card Name";

        // Replace {cardname} or ~ with the actual card name (case-insensitive)
        text = System.Text.RegularExpressions.Regex.Replace(text, @"{cardname}|~", cardName, System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        // Replace formatting shortcuts
        text = text.Replace("///", "{flavor}");
        text = text.Replace("//", "{lns}");
        text = text.Replace(" - ", " \u2014 "); // Em dash with spaces
        text = text.Replace("{-}", "\u2014"); // Em dash without spaces

        // 2. Flavor Tag Expansions
        if (text.StartsWith("{flavor}", StringComparison.OrdinalIgnoreCase))
        {
            // If the text starts exactly with flavor, it doesn't need the divider bar, just italics
            text = "{i}" + text[8..];
        }
        else
        {
            // Standard flavor expansion creates the divider bar and switches to italics
            text = text.Replace("{flavor}", "{/indent}{lns}{bar}{lns}{fixtextalign}{i}", StringComparison.OrdinalIgnoreCase);
        }

        // Old flavor and standard dividers
        text = text.Replace("{oldflavor}", "{/indent}{lns}{lns}{up30}{i}", StringComparison.OrdinalIgnoreCase);
        text = text.Replace("{divider}", "{/indent}{lns}{bar}{lns}{fixtextalign}", StringComparison.OrdinalIgnoreCase);

        // Line breaks
        text = text.Replace("\n", "{/indent}{line}");

        // 3. Token Parsing Loop
        var tokens = new List<TextToken>();
        int i = 0;

        while (i < text.Length)
        {
            // Parse Tags: {tagname}
            if (text[i] == '{')
            {
                int end = text.IndexOf('}', i);
                if (end != -1)
                {
                    // Extract everything between { and }, lowercased for easy matching
                    string tagContent = text.Substring(i + 1, end - i - 1).ToLowerInvariant();
                    tokens.Add(new TagToken(tagContent));

                    i = end + 1; // Move past the closing }
                    continue;
                }
            }

            // Parse Spaces
            if (text[i] == ' ')
            {
                tokens.Add(new SpaceToken());
                i++;
                continue;
            }

            // Parse Words
            // A word goes until the end of the string, the next space, or the next tag
            int nextSpace = text.IndexOf(' ', i);
            int nextTag = text.IndexOf('{', i);

            int endWord = text.Length;
            if (nextSpace != -1) endWord = Math.Min(endWord, nextSpace);
            if (nextTag != -1) endWord = Math.Min(endWord, nextTag);

            string word = text.Substring(i, endWord - i);
            if (!string.IsNullOrEmpty(word))
            {
                tokens.Add(new WordToken(word));
            }

            i = endWord;
        }

        return tokens;
    }
}

