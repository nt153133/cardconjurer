# Card Text Rendering – JavaScript Pipeline Analysis

> Comprehensive analysis of how the client-side JavaScript renderer handles text
> in `creator-23.js` and related modules, with notes on replicating each
> subsystem using SixLabors.ImageSharp / SixLabors.Fonts on the server.

---

## Table of Contents

1. [Overall Architecture](#1-overall-architecture)
2. [Coordinate System & Scaling](#2-coordinate-system--scaling)
3. [Text Object Schema](#3-text-object-schema)
4. [Title & Type Text (Simple Text Blocks)](#4-title--type-text-simple-text-blocks)
5. [Font Resolution & Sizing](#5-font-resolution--sizing)
6. [Text Preprocessing & Tag Splitting](#6-text-preprocessing--tag-splitting)
7. [The Outer Auto-Size Loop](#7-the-outer-auto-size-loop)
8. [Tag Processing (Inner Word Loop)](#8-tag-processing-inner-word-loop)
9. [Line Wrapping & New-Line Handling](#9-line-wrapping--new-line-handling)
10. [Mana Symbol / Icon Rendering](#10-mana-symbol--icon-rendering)
11. [Flavor Bar](#11-flavor-bar)
12. [Vertical Centering & Final Compositing](#12-vertical-centering--final-compositing)
13. [Text Justification](#13-text-justification)
14. [Arc Text](#14-arc-text)
15. [Shadows, Outlines & Stroke](#15-shadows-outlines--stroke)
16. [Beleren Font Ligatures](#16-beleren-font-ligatures)
17. [ImageSharp Replication Strategy](#17-imagesharp-replication-strategy)

---

## 1. Overall Architecture

```
drawText()                           ← called on every card redraw
 ├─ clears textCanvas (full card size)
 ├─ for each textObject in card.text:
 │     └─ writeText(textObject, textContext)
 │         ├─ uses paragraphCanvas (textbox-sized temp canvas)
 │         ├─ uses lineCanvas (single-line-height temp canvas)
 │         ├─ outer auto-size while loop
 │         │   ├─ inner word-by-word for loop (tag processing)
 │         │   ├─ word placement & measureText
 │         │   └─ shrink font by 1px on overflow → continue outerloop
 │         ├─ vertical centering adjustment
 │         └─ composite paragraphCanvas → targetContext at (textX, textY)
 └─ drawCard()
     └─ cardContext.drawImage(textCanvas, ...)   ← onto main card canvas
```

### Canvas Hierarchy

| Canvas | Purpose | Size |
|--------|---------|------|
| `cardCanvas` | Final composited card | `card.width × card.height` (with margin) |
| `textCanvas` | All text blocks combined | Same as cardCanvas |
| `paragraphCanvas` | Single text block, multi-line | `textWidth + 2*MARGIN × textHeight + 2*MARGIN` |
| `lineCanvas` | Current single line | `textWidth + 2*MARGIN × textSize + 2*MARGIN` |

- `TEXT_CANVAS_MARGIN = 300` — generous pixel padding so shadows/outlines don't clip.

---

## 2. Coordinate System & Scaling

All card positions/sizes in JSON are stored as **normalized 0–1 fractions** of the
cut-size card dimensions. Scaling functions (in `math-utilities.js`):

```js
function scaleX(input)      { return Math.round((input + card.marginX) * card.width);  }
function scaleY(input)      { return Math.round((input + card.marginY) * card.height); }
function scaleWidth(input)  { return Math.round(input * card.width);  }
function scaleHeight(input) { return Math.round(input * card.height); }
```

- `card.width` / `card.height` = pixel dimensions of the rendered card (e.g. 1984 × 2768).
- `card.marginX` / `card.marginY` = margin fraction (0 when no bleed).
- `scaleX`/`scaleY` add margins; `scaleWidth`/`scaleHeight` do not.

### ImageSharp Equivalent

Already implemented in `CardRenderV2Service`:

```csharp
static int ScaleX(double input, int cardWidth, double marginX)
    => (int)Math.Round((input + marginX) * cardWidth);
static int ScaleWidth(double input, int cardWidth)
    => Math.Max(1, (int)Math.Round(input * cardWidth));
// (analogous for Y/Height)
```

---

## 3. Text Object Schema

Each text block in `card.text` is keyed by name (e.g., `"title"`, `"type"`,
`"rules"`, `"mana"`, `"pt"`). Each has these properties:

| Property | Type | Default | Notes |
|----------|------|---------|-------|
| `x`, `y` | float (0–1) | 0 | Position as fraction of card |
| `width`, `height` | float (0–1) | 1 | Textbox size as fraction of card |
| `size` | float (0–1) | 0.038 | Starting font size as fraction of card **height** |
| `fontSize` | string/int | `"0"` | Additional pixel offset added to computed size |
| `text` | string | — | Raw text content with `{tags}` |
| `font` | string | `'mplantin'` | CSS-style font name |
| `fontStyle` | string | `''` | e.g. `'bold '`, `'italic '` |
| `color` | string | `'black'` | CSS color for `fillStyle` |
| `align` | string | `'left'` | `'left'` / `'center'` / `'right'` |
| `justify` | string | `'left'` | Controls final horizontal block alignment |
| `oneLine` | bool | `false` | Force single-line (shrinks until fits width) |
| `bounded` | bool | `true` | Auto-shrink when text overflows height |
| `manaCost` | bool | `false` | Mana cost mode (symbols only, no word spacing) |
| `lineSpacing` | float | 0 | Multiplier of textSize for extra line gap |
| `allCaps` | bool | `false` | Uppercase all text |
| `noVerticalCenter` | bool | `false` | Disable vertical centering in textbox |
| `shadow` | string | `'black'` | Shadow color |
| `shadowX`, `shadowY` | float | 0 | Shadow offset (fraction of card) |
| `shadowBlur` | float | 0 | Shadow blur radius (fraction of card) |
| `outlineColor` | string | `'black'` | Stroke color |
| `outlineWidth` | float | 0 | Outline width (fraction of card height) |
| `kerning` | float | 0 | Letter spacing (fraction of card width) |
| `arcRadius` | float | 0 | Arc text radius (fraction of card height) |
| `arcStart` | float | 0 | Arc starting angle |
| `rotation` | float | 0 | Rotation in degrees |
| `vertical` | bool | `false` | Vertical text mode |
| `manaSpacing` | float | 0 | Extra spacing between mana symbols |
| `manaSymbolColor` | string | null | Override color for mana symbols |
| `conditionalColor` | string | — | Frame-dependent color override |

---

## 4. Title & Type Text (Simple Text Blocks)

Title and Type text blocks are the simplest case. They typically:
- Have `oneLine: true` (force fit on one line).
- Use font `'belerenb'` (Beleren Bold) for title, and `'belerenb'` or `'mplantin'` for type.
- Have a fixed textbox region (`x`, `y`, `width`, `height`).
- Use `align: 'center'` for centering within the textbox.

### Flow for Title

1. **Dimensions**: `scaleHeight(textObject.size)` → pixel font size.
2. **Font**: `textObject.font || 'mplantin'` (usually explicitly `'belerenb'`).
3. **Text prep**: Only `{cardname}` / `~` replacement, no complex tags.
4. **Auto-size loop** (`oneLine: true`):
   - Measures text width with `lineContext.measureText(wordToWrite).width`.
   - If total width ≥ `textWidth`, decrements `startingTextSize` by 1px and retries.
5. **Alignment**: `textAlign == 'center'` → `horizontalAdjust = (textWidth - currentX) / 2`.
6. **Vertical center**: `verticalAdjust = (textHeight - currentY + textSize * 0.15) / 2`.
7. **Composite**: `paragraphCanvas → targetContext` at `(textX + ptShift + horizontalAdjust, textY + verticalAdjust)`.

### ImageSharp Mapping

For simple one-line text:
- Use `TextMeasurer.MeasureSize(text, options)` to check if it fits.
- Decrement font size and re-measure in a loop until it fits `textWidth`.
- Use `RichTextOptions.HorizontalAlignment = Center` for centering.
- Compute vertical centering offset manually: `(textboxHeight - measuredHeight) / 2`.
- Draw onto a temp image, then composite onto the card canvas.

---

## 5. Font Resolution & Sizing

### Font Size Calculation

```js
var startingTextSize = scaleHeight(textObject.size) || scaleHeight(0.038);
// ...
textSize += parseInt(textObject.fontSize || '0');   // additional offset
lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
```

- Base size = `textObject.size × card.height` (pixels).
- Default if missing: `0.038 × card.height` ≈ ~105px at 2768px height.
- `textObject.fontSize` adds/subtracts pixels as an adjustment.

### The Font Height Ratio

```js
const TEXT_FONT_HEIGHT_RATIO = 0.7;
```

This ratio is used for vertical baseline positioning when drawing text:

```js
lineContext.fillText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
//                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                          Y position = margin + fontSize * 0.7
```

The `0.7` factor positions the baseline approximately 70% down from the top of the line height. This accounts for ascenders being taller than the font's "body" size, placing the text at a visually correct position.

### Font Name Resolution

The JS renderer sets `lineContext.font` using CSS font syntax: `"bold 72px belerenb"`. The browser resolves the registered font family. Font names in the card JSON use compressed forms:

| JSON Font Name | Actual Font File | Notes |
|----------------|-----------------|-------|
| `mplantin` | `mplantin.ttf` | Rules text default |
| `belerenb` | `beleren-b.ttf` | Title/type on most cards |
| `belerenbsc` | `beleren-bsc.ttf` | Small caps variant |
| `mplantini` | `mplantin-i.ttf` | Italic variant for flavor |
| `gillsans` | `Gill Sans Medium.otf` | Some modern cards |
| `gothambold` | `gothambold.otf` | Serial number stamps |

**Italic/Bold handling**: The JS renderer appends to font name or prepends CSS style:
- `mplantin` + italic → sets font to `mplantini` (separate file)
- `belerenb` + italic → sets CSS `fontStyle = 'italic '` prefix
- `gillsans` + bold → appends to get `gillsansbold` (separate file)

### ImageSharp Mapping

The current C# `ResolveFont()` method handles this via:
1. Exact alias match (filename without extension, lowercased).
2. Separator-stripped match (`belerenb` → strips hyphens from `beleren-b`).
3. Substring fallback.

For italic/bold, ImageSharp uses `FontStyle` enum. The renderer should map:
- `{i}` tag + `mplantin` → load `mplantini` as a separate family (or use `FontStyle.Italic` if the font has italic glyphs).
- `{bold}` tag → use `FontStyle.Bold`.
- Combined `fontStyle + textSize + 'px ' + textFont + textFontExtension` → must decompose into font family + style.

---

## 6. Text Preprocessing & Tag Splitting

Before entering the render loop, text goes through several transforms:

### Step 1: Conditional Replacements
```js
// {cardname} / ~ → actual card name
rawText = rawText.replace(/{cardname}|~/ig, getInlineCardName());

// /// → {flavor}
rawText = rawText.replace(/\/\/\//g, '{flavor}');

// // → {lns}  (line-no-space)
rawText = rawText.replace(/\/\//g, '{lns}');

// - → — (em dash)
rawText = rawText.replace(/ - /g, ' — ');
```

### Step 2: Flavor Tag Expansion
```js
// {flavor} → compound tag sequence depending on card version
// Standard:
'{flavor}' → '{/indent}{lns}{bar}{lns}{fixtextalign}{i}'
// If text starts with {flavor}:
'{flavor}' → '{i}'
// Old (no flavor bar):
'{oldflavor}' → '{/indent}{lns}{lns}{up30}{i}'
```

### Step 3: Divider Expansion
```js
'{divider}' → '{/indent}{lns}{bar}{lns}{fixtextalign}'
```

### Step 4: Token Splitting
```js
// Uses unique split string to avoid collisions
const TEXT_SPLIT_STRING = '6GJt7eL8';

splitText = rawText
    .replace(/\n/g, '{line}')
    .replace(/{-}/g, '\u2014')             // em dash
    .replace(/{divider}/g, '...')           // already expanded
    .replace(/{/g, SPLIT + '{')
    .replace(/}/g, '}' + SPLIT)
    .replace(/ /g, SPLIT + ' ' + SPLIT)
    .split(SPLIT)
    .filter(item => item);
```

Result: array of tokens where each element is either:
- A **word** (plain text fragment)
- A **space** `' '`
- A **tag** `'{something}'`

Example: `"Flying{line}Haste"` → `["Flying", "{line}", "Haste"]`

Example: `"Draw a card. {flavor}A moment of clarity."` →
`["Draw", " ", "a", " ", "card.", " ", "{/indent}", "{lns}", "{bar}", "{lns}", "{fixtextalign}", "{i}", "A", " ", "moment", " ", "of", " ", "clarity."]`

### ImageSharp Mapping

Implement a `TokenizeText(string rawText, CardData card)` method that:
1. Applies the same replacements in order.
2. Splits into a `List<TextToken>` where each token is typed:
   - `Word(string value)`
   - `Space`
   - `Tag(string name, string? argument)` — e.g., `Tag("fontsize", "-4")`, `Tag("i", null)`

---

## 7. The Outer Auto-Size Loop

The core auto-size mechanism:

```js
var drawingText = true;
outerloop: while (drawingText) {
    // Reset all state for this attempt
    var textColor = textObject.color || 'black';
    var textFont = textObject.font || 'mplantin';
    var textSize = startingTextSize;
    textSize += parseInt(textObject.fontSize || '0');
    lineContext.font = textFontStyle + textSize + 'px ' + textFont;
    // ... set shadow, outline, etc.

    var currentX = 0, currentY = 0;

    for (word of splitText) {
        // ... process tags, measure words ...

        // WIDTH OVERFLOW (oneLine mode):
        if (wordToWrite && measureText(wordToWrite).width + currentX >= textWidth && arcRadius == 0) {
            if (textOneLine && startingTextSize > 1) {
                startingTextSize -= 1;
                continue outerloop;     // ← restart with smaller font
            }
            newLine = true;             // ← wrap to next line
        }

        // HEIGHT OVERFLOW (bounded mode):
        if (currentY > textHeight && textBounded && !textOneLine && startingTextSize > 1 && arcRadius == 0) {
            startingTextSize -= 1;
            continue outerloop;         // ← restart with smaller font
        }

        // LAST WORD → do vertical centering and composite
        if (splitText.indexOf(word) == splitText.length - 1) {
            // ... vertical/horizontal adjust ...
            targetContext.drawImage(paragraphCanvas, ...);
            drawingText = false;
        }
    }
}
```

### Key Behaviors

1. **`oneLine` mode**: Text must fit in one line. Font shrinks 1px at a time until `measureText` width fits.
2. **`bounded` mode** (default `true`): Multi-line text shrinks 1px at a time until `currentY ≤ textHeight`.
3. **Unbounded**: No auto-shrinking; text can overflow its box.
4. **Minimum size**: Font cannot go below 1px (`startingTextSize > 1` guard).

### Performance Note

This is a linear search — worst case shrinks from max font size down 1px at a time, re-rendering all text each iteration. For a 100px font that needs to be 60px, that's 40 full passes.

### ImageSharp Mapping

```csharp
float fontSize = startingTextSize;
while (fontSize > 1f)
{
    var (totalHeight, fitsWidth) = MeasureTextLayout(tokens, fontSize, textWidth, textHeight, font, oneLine);

    if (oneLine && !fitsWidth)
    {
        fontSize -= 1f;
        continue;
    }
    if (bounded && totalHeight > textHeight)
    {
        fontSize -= 1f;
        continue;
    }
    break;
}
// Now render at fontSize
```

Better: use binary search on font size for O(log n) instead of O(n), or use
`TextMeasurer.MeasureSize()` to estimate and converge faster.

---

## 8. Tag Processing (Inner Word Loop)

The inner loop processes each token. Tags are identified by containing `{` and `}`.
The tag name is extracted via `possibleCode = word.toLowerCase().replace('{','').replace('}','')`.

### Complete Tag Reference

| Tag | Effect |
|-----|--------|
| `{line}` | New line with 0.35× textSize spacing |
| `{lns}` / `{linenospace}` | New line with no extra spacing |
| `{i}` | Start italic (font-dependent: `mplantin`→`mplantini`, others→CSS italic) |
| `{/i}` | End italic |
| `{bold}` | Start bold |
| `{/bold}` | End bold |
| `{left}` / `{center}` / `{right}` | Change line alignment |
| `{justify-left}` / `-center` / `-right` | Change block justification |
| `{fontcolor<css>}` | Change text color (e.g., `{fontcolorwhite}`) |
| `{fontsize<N>}` | Adjust font size by N pixels (e.g., `{fontsize-4}`) |
| `{fontsize<N>pt}` | Set font size to N points (converted: `N * 600/72`) |
| `{font<name>}` | Change font family (e.g., `{fontbelerenb}`) |
| `{outline<N>}` | Set stroke width to N pixels |
| `{outlinecolor<css>}` | Set stroke color |
| `{shadow<N>}` | Set shadow X and Y offset |
| `{shadowcolor<css>}` | Set shadow color |
| `{shadowblur<N>}` | Set shadow blur |
| `{shadowx<N>}` / `{shadowy<N>}` | Set shadow X/Y independently |
| `{up<N>}` | Move cursor up N pixels |
| `{down<N>}` | Move cursor down N pixels |
| `{left<N>}` | Move cursor left N pixels |
| `{right<N>}` | Move cursor right N pixels |
| `{upinline<N>}` | Shift line Y position (for inline adjustments) |
| `{kerning<N>}` | Set letter-spacing to N pixels |
| `{indent}` | Start indent from current X position |
| `{/indent}` | Reset indent |
| `{bar}` | Draw flavor bar image |
| `{bullet}` / `{•}` | Render bullet character |
| `{elemid<id>}` | Insert value of HTML element with given id |
| `{savex}` / `{loadx}` | Save/restore X position |
| `{savex2}` / `{loadx2}` | Second X position save/restore |
| `{ptshift<x>,<y>}` | Shift the final composite position (for P/T box interaction) |
| `{permashift<x>,<y>}` | Permanent shift applied to final composite |
| `{roll<text>}` | D20 roll box: draw text in Beleren, shade background |
| `{rollcolor<css>}` | Set roll box background color |
| `{arcradius<N>}` | Set text arc radius |
| `{arcstart<N>}` | Set arc starting angle |
| `{rotate<N>}` | Set text rotation in degrees |
| `{manacolor<css>}` | Override mana symbol color |
| `{manacolordefault}` | Reset mana symbol color |
| `{fixtextalign}` | Restore original text alignment |
| `{linecap<v>}` | Set `lineCap` (e.g., `round`) |
| `{linejoin<v>}` | Set `lineJoin` |
| `{conditionalcolor:...}` | Frame-dependent color change |
| `{planechase}` | Draw chaos symbol (planechase cards) |
| `{w}`, `{u}`, `{b}`, `{r}`, `{g}`, `{t}`, `{1}`, etc. | Mana symbols (matched via `getManaSymbol()`) |

### ImageSharp Mapping

Build a tag interpreter as a state machine:

```csharp
class TextRenderState
{
    public Font CurrentFont;
    public Color CurrentColor;
    public float TextSize;
    public float CurrentX, CurrentY;
    public bool Italic, Bold;
    public float OutlineWidth;
    public Color OutlineColor;
    // ... shadow, indent, etc.
}

foreach (var token in tokens)
{
    switch (token)
    {
        case TagToken { Name: "i" }:       state.Italic = true; RebuildFont(); break;
        case TagToken { Name: "/i" }:      state.Italic = false; RebuildFont(); break;
        case TagToken { Name: "bold" }:    state.Bold = true; RebuildFont(); break;
        case TagToken { Name: "line" }:    NewLine(spacing: 0.35f); break;
        case TagToken { Name: "lns" }:     NewLine(spacing: 0); break;
        case TagToken t when t.Name.StartsWith("fontsize"): AdjustSize(t); break;
        // ... mana symbol cases ...
        case WordToken w:                  DrawWord(w); break;
    }
}
```

---

## 9. Line Wrapping & New-Line Handling

### Word Width Check

```js
if (wordToWrite && lineContext.measureText(wordToWrite).width + currentX >= textWidth && textArcRadius == 0) {
    if (textOneLine && startingTextSize > 1) {
        startingTextSize -= 1;
        continue outerloop;    // shrink font
    }
    newLine = true;            // wrap to next line
}
```

### New Line Processing

When `newLine` is true or the last word is reached:

```js
if ((newLine && !textOneLine) || splitText.indexOf(word) == splitText.length - 1) {
    // Compute horizontal alignment offset
    var horizontalAdjust = 0;
    if (textAlign == 'center') {
        horizontalAdjust = (textWidth - currentX) / 2;
    } else if (textAlign == 'right') {
        horizontalAdjust = textWidth - currentX;
    }

    // Track widest line (for block justify)
    if (currentX > widestLineWidth) {
        widestLineWidth = currentX;
    }

    // Render queued mana symbols
    if (manaSymbolsToRender.length > 0) {
        renderManaSymbols();
    }

    // Composite lineCanvas → paragraphCanvas at Y offset
    paragraphContext.drawImage(lineCanvas, horizontalAdjust, currentY);

    // Reset for next line
    lineY = 0;
    lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
    currentX = startingCurrentX;
    currentY += textSize + newLineSpacing;
    newLineSpacing = (textObject.lineSpacing || 0) * textSize;
    newLine = false;
}
```

### Line Height Calculation

```
lineHeight = textSize + newLineSpacing
```

where:
- `textSize` = current font size in pixels
- `newLineSpacing` = `textObject.lineSpacing * textSize` (default 0)
- `{line}` tag overrides `newLineSpacing = textSize * 0.35` (extra 35% gap)
- `{lns}` tag keeps current `newLineSpacing` (usually 0 → tighter spacing)

### Word Rendering Position

```js
lineContext.fillText(wordToWrite,
    currentX + canvasMargin,                          // X
    canvasMargin + textSize * textFontHeightRatio + lineY  // Y (baseline)
);
currentX += lineContext.measureText(wordToWrite).width;
```

- **Y position** = `canvasMargin + textSize * 0.7 + lineY`
- The `0.7` factor (`TEXT_FONT_HEIGHT_RATIO`) places the baseline ~70% down from the top of the font size.
- `lineY` allows inline vertical adjustments via `{upinline}`.

### ImageSharp Mapping

ImageSharp `DrawText` positions from the **top** of the text bounding box by default,
not from the baseline. The `0.7` ratio won't directly apply. Instead:
- Use `TextMeasurer.MeasureSize()` to get actual bounds.
- Position each line's Y origin at `currentY` (accumulating `textSize + lineSpacing`).
- Or use `RichTextOptions` with `VerticalAlignment.Top` and let the font metrics handle baseline internally.

For word-by-word rendering:
- Measure each word with `TextMeasurer.MeasureSize(word, options)`.
- If `currentX + wordWidth > textWidth`, start new line.
- Draw word at `(currentX, currentY)` on the text layer.
- Advance `currentX += wordWidth`.

---

## 10. Mana Symbol / Icon Rendering

### Symbol Registry

Symbols are loaded at startup via `loadManaSymbols()` in `creator-23.constants.js`:

```js
function loadManaSymbols(matchColor, manaSymbolPaths, size = [1, 1]) {
    manaSymbolPaths.forEach(item => {
        var manaSymbol = {
            name: item.split('.')[0],
            path: item,
            matchColor: matchColor,
            width: size[0],      // relative width multiplier (default 1)
            height: size[1],     // relative height multiplier (default 1)
            image: new Image()   // HTMLImageElement
        };
        manaSymbol.image.src = '/img/manaSymbols/' + manaSymbol.path + '.svg';
        mana.set(manaSymbol.name, manaSymbol);
    });
}
```

Lookup: `getManaSymbol(key)` returns `mana.get(key)` or `undefined`.

### Symbol Detection in Token Loop

```js
if (getManaSymbol(possibleCode.replaceAll('/', '')) != undefined
    || getManaSymbol(possibleCode.replaceAll('/', '').split('').reverse().join('')) != undefined) {
    // It's a mana symbol
}
```

Note: tries both forward and reversed name (e.g., `{wu}` and `{uw}` both match).

### Symbol Sizing

```js
var manaSymbolSpacing = textSize * 0.04 + textManaSpacing;
var manaSymbolWidth  = manaSymbol.width  * textSize * 0.78;
var manaSymbolHeight = manaSymbol.height * textSize * 0.78;
```

- Symbol size = **78%** of current text size × the symbol's intrinsic size multiplier.
- Extra spacing of **4%** of text size on each side.

### Symbol Positioning

```js
var manaSymbolX = currentX + canvasMargin + manaSymbolSpacing;
var manaSymbolY = canvasMargin + textSize * 0.34 - manaSymbolHeight / 2;
```

- **X**: after current text position + spacing.
- **Y**: centered at `textSize * 0.34` from the top (roughly the vertical center of the text line).

### Symbol Rendering

Symbols are queued in `manaSymbolsToRender[]` and batch-rendered when a line break occurs:

```js
function renderManaSymbols() {
    if (!hasAnyOutlines) {
        // Simple path: just drawImage each symbol
        manaSymbolsToRender.forEach(symbolData => {
            lineContext.drawImage(symbolData.symbol.image,
                symbolData.x, symbolData.y,
                symbolData.width, symbolData.height);
        });
    } else {
        // Complex path: multi-pass for outlines
        // Pass 1: Draw filled circles behind symbols as outlines
        // Pass 2: Draw symbols on top
    }
}
```

### Advance After Symbol

```js
currentX += manaSymbolWidth + manaSymbolSpacing * 2;
```

### ImageSharp Mapping

1. **Load SVG symbols**: ImageSharp doesn't natively render SVG. Options:
   - Pre-rasterize SVGs to PNG at needed sizes (recommended).
   - Use `Svg.Skia` or similar library to rasterize SVGs at runtime.
   - Store pre-rendered PNGs alongside SVGs (at e.g. 200px height).

2. **Symbol lookup**: Build a `Dictionary<string, ManaSymbolInfo>` from the same
   `/img/manaSymbols/` directory. Include reverse-name entries.

3. **Sizing**: `symbolPixelSize = textSizePx * 0.78 * symbol.SizeMultiplier`

4. **Positioning**: Same formulas as JS, placed relative to the text line.

5. **Drawing**: `canvas.Mutate(ctx => ctx.DrawImage(symbolImage, new Point(x, y), 1f))`.

---

## 11. Flavor Bar

The flavor bar is rendered as a mana symbol image (named `"bar"`) when the `{bar}` tag is encountered:

```js
} else if (possibleCode == 'bar') {
    var barWidth = textWidth * 0.96;
    var barHeight = scaleHeight(0.03);
    lineContext.drawImage(
        getManaSymbol('bar').image,
        canvasMargin + (textWidth - barWidth) / 2,   // centered
        canvasMargin + barDistance * textSize,
        barWidth,
        barHeight
    );
}
```

- Width: 96% of the textbox width.
- Height: 3% of card height.
- Horizontally centered within the textbox.
- The `{flavor}` tag expands to: `{/indent}{lns}{bar}{lns}{fixtextalign}{i}` — this means:
  1. Reset indent
  2. New line (no space)
  3. Draw flavor bar
  4. New line (no space)
  5. Restore text alignment
  6. Start italic

### ImageSharp Mapping

Load `bar.svg` as an image and draw it centered:
```csharp
var barWidth = (int)(textWidth * 0.96);
var barHeight = ScaleHeight(0.03, cardHeight);
var barX = (textWidth - barWidth) / 2;
textLayer.Mutate(ctx => ctx.DrawImage(barImage, new Point(barX, currentY), 1f));
```

---

## 12. Vertical Centering & Final Compositing

After all words are processed (last token), the renderer computes final positioning:

### Vertical Centering

```js
var verticalAdjust = 0;
if (!textObject.noVerticalCenter) {
    verticalAdjust = (textHeight - currentY + textSize * 0.15) / 2;
}
```

- `currentY` at this point = total height of all rendered lines.
- `textSize * 0.15` = small correction (15% of font size) to account for descenders/spacing.
- Result: text block is **vertically centered** within its textbox.

### Horizontal Block Justification

```js
var finalHorizontalAdjust = 0;
const horizontalAdjustUnit = (textWidth - widestLineWidth) / 2;
if (textJustify == 'right' && textAlign != 'right') {
    finalHorizontalAdjust = 2 * horizontalAdjustUnit;
    if (textAlign == 'center') {
        finalHorizontalAdjust = horizontalAdjustUnit;
    }
} else if (textJustify == 'center' && textAlign != 'center') {
    finalHorizontalAdjust = horizontalAdjustUnit;
    if (textAlign == 'right') {
        finalHorizontalAdjust = -horizontalAdjustUnit;
    }
}
```

This positions the entire text **block** horizontally within the textbox, separately
from per-line alignment. For example, `align: 'left', justify: 'center'` means each
line is left-aligned internally, but the whole block is centered within the textbox.

### Final Composite

```js
if (textRotation) {
    trueTargetContext.save();
    trueTargetContext.translate(shapeX, shapeY);
    trueTargetContext.rotate(Math.PI * textRotation / 180);
    trueTargetContext.drawImage(paragraphCanvas,
        permaShift[0] - canvasMargin + finalHorizontalAdjust,
        verticalAdjust - canvasMargin + permaShift[1]);
    trueTargetContext.restore();
} else {
    trueTargetContext.drawImage(paragraphCanvas,
        textX - canvasMargin + ptShift[0] + permaShift[0] + finalHorizontalAdjust,
        textY - canvasMargin + verticalAdjust + ptShift[1] + permaShift[1]);
}
drawingText = false;
```

- `canvasMargin` is subtracted because `paragraphCanvas` has padding.
- `ptShift` = shift from `{ptshift}` tag (P/T box interaction).
- `permaShift` = permanent shift from `{permashift}` tag.

### ImageSharp Mapping

```csharp
// Measure total rendered height
float totalTextHeight = currentY; // accumulated from line advances
float verticalAdjust = textBlock.NoVerticalCenter != true
    ? (textboxHeight - totalTextHeight + fontSize * 0.15f) / 2f
    : 0f;

// Compute block justification
float blockHorizontalAdjust = ComputeBlockJustify(textJustify, textAlign, textboxWidth, widestLineWidth);

// Composite text layer onto card
var position = new Point(
    textX + (int)blockHorizontalAdjust,
    textY + (int)verticalAdjust
);
canvas.Mutate(ctx => ctx.DrawImage(textLayer, position, 1f));
```

For rotation, use `ctx.Transform(Matrix3x2.CreateRotation(...))` before drawing.

---

## 13. Text Justification

The renderer has a custom justified-text system for bottom-info text (set/number fields):

```js
function renderTextJustified(ctx, text, x, y, width, renderType) {
    var words = text.split(" ");
    var wordsWidth = sum of individual word widths;
    var spaces = words.length - 1;
    var spaceWidth = measureText(" ").width;

    // Computed space size, clamped between min and max multipliers
    var adjSpace = Math.max(spaceWidth * minSpaceSize, (width - wordsWidth) / spaces);
    var useSize = adjSpace > spaceWidth * maxSpaceSize ? spaceWidth : adjSpace;

    // Draw each word with custom spacing
    for (var i = 0; i < words.length; i++) {
        renderer(words[i].word, x, y);
        x += words[i].width + useSize;
    }
}
```

- `maxSpaceSize = 6` (max multiplier of normal space width).
- `minSpaceSize = 0.5` (min multiplier).
- Used via `lineContext.fillJustifyText(word, x, y, justifyWidth, settings)`.

### ImageSharp Mapping

ImageSharp doesn't have built-in justified text, but the same algorithm can be
replicated by drawing word-by-word with computed spacing.

---

## 14. Arc Text

Text can be rendered along a circular arc (used for some card layouts):

```js
CanvasRenderingContext2D.prototype.fillTextArc = function(text, x, y, radius, startRotation, distance, outlineWidth) {
    this.save();
    this.translate(x - distance + scaleWidth(0.5), y + radius);
    this.rotate(startRotation + widthToAngle(distance, radius));
    for (var i = 0; i < text.length; i++) {
        var letter = text[i];
        if (outlineWidth >= 1) this.strokeText(letter, 0, -radius);
        this.fillText(letter, 0, -radius);
        this.rotate(widthToAngle(this.measureText(letter).width, radius));
    }
    this.restore();
};

function widthToAngle(width, radius) {
    return width / radius;
}
```

Each character is drawn at `-radius` offset from the center, then the context is
rotated by `charWidth / radius` radians for the next character.

### ImageSharp Mapping

No built-in arc text. Must be done character-by-character:
1. For each character, compute angle = accumulated width / radius.
2. Use affine transforms to position and rotate each character glyph.
3. This is complex but doable with `DrawText` + per-character `Matrix3x2` transforms.

---

## 15. Shadows, Outlines & Stroke

### Shadow

```js
lineContext.shadowColor = textShadowColor;    // default 'black'
lineContext.shadowOffsetX = scaleWidth(textObject.shadowX) || 0;
lineContext.shadowOffsetY = scaleHeight(textObject.shadowY) || 0;
lineContext.shadowBlur = scaleHeight(textObject.shadowBlur) || 0;
```

Canvas shadow applies automatically to all `fillText` and `drawImage` calls.

### Outline (Stroke)

```js
lineContext.strokeStyle = textObject.outlineColor || 'black';
lineContext.lineWidth = scaleHeight(textObject.outlineWidth) || 0;
lineContext.lineCap = textObject.lineCap || 'round';
lineContext.lineJoin = textObject.lineJoin || 'round';

// Drawing order: stroke first, then fill
if (textOutlineWidth >= 1) {
    lineContext.strokeText(wordToWrite, x, y);
}
lineContext.fillText(wordToWrite, x, y);
```

### ImageSharp Mapping

**Shadow**: Draw text twice — first in shadow color offset by (shadowX, shadowY)
with Gaussian blur, then draw main text on top.

**Outline/Stroke**: ImageSharp.Drawing supports text outlines via `Pen`:
```csharp
var pen = new SolidPen(outlineColor, outlineWidth);
ctx.DrawText(options, text, brush: solidBrush, pen: pen);
```

---

## 16. Beleren Font Ligatures

Special handling for the Beleren Bold font:

```js
if (wordToWrite && lineContext.font.endsWith('belerenb')) {
    wordToWrite = wordToWrite
        .replace(/f(?:\s|$)/g, '\ue006')
        .replace(/h(?:\s|$)/g, '\ue007')
        .replace(/m(?:\s|$)/g, '\ue008')
        .replace(/n(?:\s|$)/g, '\ue009')
        .replace(/k(?:\s|$)/g, '\ue00a');
}
```

This replaces certain characters at word endings with Private Use Area (PUA)
codepoints for custom ligatures/kerning in the Beleren font file.

### ImageSharp Mapping

Apply the same regex replacements to text before rendering when using the Beleren font.

---

## 17. ImageSharp Replication Strategy

### Phase 1: Basic Text (Title, Type, P/T)

- [x] Font loading and alias resolution (done)
- [x] Basic `DrawText` with `RichTextOptions` (done)
- [ ] Font size calculation: `textObject.size × card.height`
- [ ] `oneLine` auto-shrink loop
- [ ] Per-line horizontal alignment (left/center/right)
- [ ] Vertical centering: `(boxHeight - renderedHeight + fontSize*0.15) / 2`
- [ ] Font style (bold/italic) handling

### Phase 2: Rules Text & Tag Processing

- [ ] Text tokenizer (split into words/spaces/tags)
- [ ] Tag state machine interpreter
- [ ] `{i}`, `{/i}`, `{bold}`, `{/bold}` → font style changes
- [ ] `{line}`, `{lns}` → line breaks with correct spacing
- [ ] `{fontsize}`, `{fontcolor}`, `{font}` → mid-text changes
- [ ] `{indent}`, `{/indent}` → indent tracking
- [ ] Multi-line bounded auto-shrink
- [ ] Word-by-word measurement and line wrapping

### Phase 3: Mana Symbols

- [ ] Load symbol images (pre-rasterized PNGs from SVGs)
- [ ] Symbol lookup with forward + reverse name matching
- [ ] Symbol sizing: `textSize * 0.78 * symbol.sizeMultiplier`
- [ ] Symbol Y centering: `textSize * 0.34 - symbolHeight / 2`
- [ ] Inline symbol placement with spacing
- [ ] Batch rendering (simple path — no outline support needed initially)

### Phase 4: Flavor & Advanced

- [ ] `{flavor}` expansion and flavor bar image
- [ ] `{bar}` rendering (96% width, 3% card height, centered)
- [ ] Block-level justification (`justify` property)
- [ ] `{shadow}`, `{outline}` support
- [ ] Beleren font ligature PUA replacements
- [ ] `{conditionalcolor}` frame-dependent color

### Phase 5: Exotic Features (Low Priority)

- [ ] Arc text (`arcRadius`, `arcStart`)
- [ ] Text rotation (`rotation`)
- [ ] Vertical text mode
- [ ] Roll boxes (D20 cards)
- [ ] Planechase chaos symbol
- [ ] Justified text (bottom info)
- [ ] `{ptshift}`, `{permashift}` adjustments
- [ ] `{elemid}` value injection
- [ ] `{savex}` / `{loadx}` position bookmarks

### Recommended Architecture

```
CardTextRenderer (new class)
├── TokenizeText(rawText, cardData) → List<TextToken>
├── MeasureLayout(tokens, fontSize, textWidth, ...) → LayoutResult
├── RenderToLayer(tokens, fontSize, textWidth, textHeight, ...) → Image<Rgba32>
│   ├── TagInterpreter (state machine)
│   ├── LineBuilder (word wrapping, measurement)
│   ├── ManaSymbolRenderer (symbol lookup, sizing, drawing)
│   └── FlavorBarRenderer
└── CompositeOntoCard(textLayer, card, textBlock) → void
```

This separates concerns and allows independent testing of each subsystem.
The auto-size loop wraps around `MeasureLayout` → check fit → decrement font size.
Once the correct size is found, `RenderToLayer` does the actual drawing.

