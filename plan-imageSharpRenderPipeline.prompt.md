## Plan: Migrate Card Image Rendering to C# / ImageSharp Pipeline

The existing rendering pipeline lives entirely in browser-side JavaScript, using multi-canvas compositing (`drawFrames` in `creator-23.js` line 656, `drawCard` in `rendering.js` line 5, `writeText` in `creator-23.js`). The server currently only post-processes a **pre-rendered canvas PNG** — metadata embedding and crop/bleed in `Services/CardImage/CardImageService.cs`. This plan covers migrating actual compositing and text rendering into C#/ImageSharp, offered on a new standalone page alongside the existing Creator page, starting with frame compositing and progressing through art and text.

---

### Implementation Route Comparison

#### Route A — Pure Server-Side C# (ImageSharp, API-driven)

| Dimension | Detail |
|---|---|
| **How** | Client POSTs the `card` JSON to a new endpoint; server loads frame/mask/art images from disk or URLs, composites with ImageSharp `DrawImage`, applies per-pixel HSL/mask/erase ops, renders text via `SixLabors.Fonts` / `ImageSharp.Drawing`, returns a finished PNG stream. |
| **Pros** | Single C# render codebase. Works on any device/browser (thin client). Consistent rendering quality. Reuses existing `CardData`, `CardSizeCatalog`, `ICardImageService`. Server can cache intermediate frame images across requests. Deterministic font rendering (no browser font-loading races). Natural fit for batch/headless render. |
| **Cons** | Network round-trip per preview (every art drag, zoom, text edit). Significant server CPU + RAM (a full-size 2010×2814 RGBA32 canvas is ~22 MB per layer, and cards use 5-15 layers). Live interactive editing requires debounced requests or a separate lighter preview path. Horizontal scaling requires stateless design. |
| **Best for** | Batch/print workflows, headless render, final download path. Also the best **first prototype** because it validates the compositing pipeline without WASM complexity. |

#### Route B — Client-Side C# via Blazor WebAssembly + ImageSharp

| Dimension | Detail |
|---|---|
| **How** | A Blazor WASM component loads ImageSharp WASM binaries (~2-3 MB gzipped), receives card JSON, fetches frame asset bytes via HTTP, runs the identical C# compositing pipeline entirely in-browser. Could share the same service classes as Route A via a shared library project. |
| **Pros** | Zero server load for rendering. Instant interactivity (no network round-trip per edit). Shares C# data model and render code with server. |
| **Cons** | Large WASM payload (~3-5 MB initial download). ImageSharp in WASM is ~3-10× slower than native (no SIMD in older browsers). High browser memory pressure (multi-layer 2K images). Canvas API uses GPU; WASM ImageSharp is CPU-only. Some font files (`.otf`) may need conversion to `.ttf`. More complex build (requires a Blazor WASM project or hosted component). |
| **Best for** | Exploratory prototyping, but likely too slow for interactive preview at full resolution. Could work for a scaled-down preview (e.g. 500×700) while server handles full-res. |

#### Route C — Hybrid (recommended long-term)

| Dimension | Detail |
|---|---|
| **How** | Client-side JS canvas or a small Blazor WASM component remains the **live interactive preview** (can be a simplified/scaled-down pipeline). On download/export, client sends the `card` JSON to the server which does the authoritative high-resolution render via ImageSharp. |
| **Pros** | Best of both worlds: instant interactive preview without server round-trips; pixel-perfect deterministic final output on server. Incremental migration — each layer type can be moved to server one at a time while the JS preview remains functional. |
| **Cons** | Two render codebases to maintain (JS preview + C# final). Risk of visual drift between preview and output unless carefully kept in sync. |
| **Best for** | The project's actual usage pattern (interactive editing with occasional high-quality export). |

**Recommendation**: Prototype **Route A** (pure server render) on the new page first, because it validates the C# compositing pipeline with no WASM complexity. Later, add a lightweight client preview (JS canvas scaled-down, or Blazor WASM at reduced resolution) to get interactive editing speed, with the server C# path as the authoritative final renderer (Route C).

---

### New Page Architecture

The new page will be **completely independent** from the existing Creator — no shared JavaScript globals, no `creator-23.js`, no canvas-based rendering. It uses the same asset library infrastructure (frame images served from `wwwroot/img/`, user uploads from `data/uploads/` at `/user-content`).

#### New files

```
Pages/
    RendererV2.cshtml              # standalone Razor page at /renderer-v2
    RendererV2.cshtml.cs           # page model (minimal)
Endpoints/
    RenderV2Endpoints.cs           # POST /api/render-v2/preview, /api/render-v2/download
Services/CardImage/Rendering/
    CardRenderPipeline.cs          # orchestrator: create canvas → art → frames → text → encode
    FrameCompositor.cs             # Phase 1: frame layer compositing
    ArtRenderer.cs                 # Phase 2: art placement
    TextRenderer.cs                # Phase 3: text rendering
    InlineTagParser.cs             # text tag tokenizer ({i}, {bold}, {line}, mana symbols, etc.)
    FontRegistry.cs                # font loading singleton
    ImageResolver.cs               # resolve src path → Image<Rgba32>
    ImageCompositeExtensions.cs    # reusable pixel-level ops (source-in, destination-out, HSL)
Models/CardImage/
    RenderV2Request.cs             # API request model (subset of CardData for v1)
    TextRun.cs                     # parsed rich-text segment (font, size, color, style, text)
    CardCoordinates.cs             # port of scaleX/Y/Width/Height from math-utilities.js
wwwroot/js/renderer-v2/
    renderer-v2.js                 # thin client: form handling, fetch to server, display result
wwwroot/data/frame-packs/
    (future) converted JSON frame pack definitions
```

#### Page UI (v1 — minimal)

The `RendererV2.cshtml` page has:
- A textarea to paste card JSON (from the existing Creator's "Copy card JSON" or from a saved `.json` file)
- OR a file input to upload a `.json` card file
- A "Render Preview" button that POSTs to the server and displays the returned PNG in an `<img>` tag
- A "Download" button for the full-resolution PNG
- Status/error display area
- Links to the existing Creator page and asset library

No frame picker, no art drag UI, no text editor — those stay in the existing Creator page. This page is purely for validating the server render pipeline against known card JSON payloads.

#### Endpoint wiring

In `Program.cs`, add:
```csharp
app.MapRenderV2Endpoints();
```

`RenderV2Endpoints.cs` exposes:
- `POST /api/render-v2/preview` — accepts `RenderV2Request` (card JSON), returns PNG at reduced size (e.g. 800×1120)
- `POST /api/render-v2/full` — returns full-resolution PNG

---

### Phase Breakdown

#### Phase 1 — Basic Frame Compositing

**Goal**: Load frame layer images and mask images from disk, composite them using the same logic as `drawFrames()` in `creator-23.js` line 656.

**Key JS logic to port** (from `drawFrames()`):
```
For each frame (in reverse order):
  1. Fill masking canvas with solid black
  2. globalCompositeOperation = 'source-in'
  3. Draw each mask image onto masking canvas (→ black pixels where mask is opaque)
  4. Draw frame image onto masking canvas (→ frame clipped to mask shape)
  5. If colorOverlay: fill with overlay color using source-in
  6. If HSL adjustments: per-pixel RGB→HSL shift
  7. If erase mode: draw onto main canvas with destination-out
  8. If preserveAlpha: per-pixel blend (preserve existing alpha, blend RGB)
  9. Otherwise: draw masked result onto main frame canvas with source-over
```

**Implementation in `FrameCompositor.cs`**:

1. Accept a base `Image<Rgba32>` canvas and `List<CardFrame>` from `CardData`.

2. For each frame, use `ImageResolver` to load the frame image from its `Src` path (e.g. `/img/frames/m15/regular/m15FrameW.png` → physical file under `wwwroot/`).

3. Load each mask image similarly.

4. Port the mask pipeline as pixel-level operations in `ImageCompositeExtensions.cs`:
   - `ApplySourceIn(Image<Rgba32> target, Image<Rgba32> source)` — per-pixel: target alpha = min(target.A, source.A), then draw source RGB where alpha > 0. This replaces `globalCompositeOperation = 'source-in'`.
   - `ApplyDestinationOut(Image<Rgba32> target, Image<Rgba32> source)` — per-pixel: reduce target alpha by source alpha. This replaces erase mode.
   - `ApplyPreserveAlphaBlend(Image<Rgba32> existing, Image<Rgba32> newImage, Image<Rgba32> mask, float opacity)` — the custom per-pixel blend at lines 688-701 in `creator-23.js`.

5. Port `hsl()` from `color-canvas-utilities.js` — per-pixel RGB↔HSL conversion with hue/saturation/lightness offsets, using `ProcessPixelRows`.

6. Handle `colorOverlay` via source-in fill: create a solid-color image, apply source-in with the masked frame.

7. Handle `opacity` as an alpha multiplier on the frame layer before compositing.

8. Handle `bounds` using `CardCoordinates` to scale normalized 0-1 coordinates to pixel positions. Port `scaleX`, `scaleY`, `scaleWidth`, `scaleHeight` from `math-utilities.js`.

**`ImageResolver.cs`**:
- Resolves a frame/mask `src` string (e.g. `/img/frames/m15/regular/m15FrameW.png`) to a physical file path under `wwwroot/`.
- Resolves `/user-content/...` paths to the `data/uploads/` directory.
- Handles remote URLs (art from Scryfall, etc.) via `HttpClient` with timeout and size limits.
- Uses `IMemoryCache` with configurable max size (e.g. 200 MB) — frame/mask images are shared across users and rarely change.
- Returns cloned `Image<Rgba32>` instances to avoid concurrent mutation.

#### Phase 2 — Art Placement

**Goal**: Draw the user's art image at the correct position/zoom/rotation, matching `drawCard()` lines 10-17 in `rendering.js`.

**JS logic to port**:
```javascript
cardContext.save();
cardContext.translate(scaleX(card.artX), scaleY(card.artY));
cardContext.rotate(Math.PI / 180 * (card.artRotate || 0));
cardContext.drawImage(art, 0, 0, art.width * card.artZoom, art.height * card.artZoom);
cardContext.restore();
```

**Implementation in `ArtRenderer.cs`**:

1. Load art image via `ImageResolver` (supports local paths and remote URLs).

2. Calculate target dimensions: `art.Width * artZoom`, `art.Height * artZoom`.

3. Resize the art image to target dimensions using `image.Mutate(x => x.Resize(...))`.

4. If `artRotate != 0`, apply rotation using `image.Mutate(x => x.Rotate(degrees))`.

5. Draw onto canvas at the translated position using `canvas.Mutate(x => x.DrawImage(art, location, opacity))`.

6. Art is drawn **first** (behind frames), matching the JS compositing order.

#### Phase 3 — Text Rendering

**Goal**: Render text boxes (title, type, rules, P/T, mana) using `SixLabors.Fonts` and `ImageSharp.Drawing`, covering the core of `writeText()` in `creator-23.js`.

This is the most complex phase. The JS text system supports inline formatting tags, auto-shrink to fit, multi-line layout, mana symbol images, and custom alignment.

**`FontRegistry.cs`** (singleton):
- Scans `wwwroot/fonts/` on startup.
- Loads each `.ttf`/`.otf` into a `SixLabors.Fonts.FontCollection`.
- Maps the CSS font-family names used in card JSON (e.g. `mplantin`, `belerenb`, `gothambold`, `matrixb`) to their `FontFamily` objects.
- Provides `GetFont(string family, float size, FontStyle style)` → `Font`.

**`InlineTagParser.cs`**:
- Tokenizes raw text strings into `List<TextRun>`.
- Each `TextRun` has: `string Text`, `string FontFamily`, `float FontSize`, `Color Color`, `bool Italic`, `bool Bold`, `bool IsLineBreak`, `bool IsSymbol`.
- **v1 tags to support**: `{i}` / `{/i}` (italic), `{bold}` / `{/bold}`, `{line}` (hard line break), `{lns}` (line break + separator), `{fontsize___}` (size override), `{fontcolor___}` (color override), `{font___}` / `{/font}`.
- **Deferred to future**: mana symbol images (`{w}`, `{u}`, etc.), `{pointed}`, `{flavor}`, `{bar}`, `{pointed}`, `{kerning}`.

**`TextRenderer.cs`**:
- For each `CardTextObject` in `card.Text`:
  1. Parse raw text via `InlineTagParser`.
  2. Calculate pixel position/size from normalized coordinates using `CardCoordinates`.
  3. Create a scratch `Image<Rgba32>` for the text box.
  4. Render `TextRun` segments sequentially, tracking the current x/y cursor.
  5. Use `SixLabors.Fonts.TextOptions` for layout (horizontal alignment, word wrap via `WrappingLength`).
  6. Implement the auto-shrink loop: start at the declared font size, reduce by 1 until text fits within `textHeight`. This matches the `outerloop` while-loop in `writeText()`.
  7. Composite the text box scratch image onto the main canvas.

---

### Pipeline Orchestration

`CardRenderPipeline.cs` coordinates the render phases in the correct order matching the JS compositing:

```
1. Create blank canvas: Image<Rgba32>(width, height)
2. ArtRenderer.DrawArt(canvas, cardData)           // art behind everything
3. FrameCompositor.DrawFrames(canvas, cardData)     // frame layers with masks
4. TextRenderer.DrawText(canvas, cardData)           // text on top of frames
5. Encode as PNG → return Stream
```

Registered as a **scoped** service (one per request, owns disposable `Image<>` instances). Depends on:
- `ImageResolver` (singleton with caching)
- `FontRegistry` (singleton)

---

### What Is Already In Place (reusable)

| Existing asset | Reuse for |
|---|---|
| `Models/CardImage/CardData.cs` — full card JSON model with `Frames`, `Text`, art fields | Direct input to the pipeline; no new model needed for v1 |
| `Models/CardImage/CardFrame.cs`, `CardFrameMask.cs`, `CardBounds.cs` | Frame compositing input |
| `Models/CardImage/CardTextObject.cs` | Text rendering input |
| `Models/CardImage/Sizing/CardSizeProfile.cs`, `CardSizeCatalog.cs` | Canvas size selection |
| `Models/CardImage/Sizing/BleedAdder.cs` | Future: margins/bleed phase |
| `Services/CardImage/CardImageService.cs` | Future: metadata embedding, crop, encode |
| `SixLabors.ImageSharp`, `.Drawing`, `.Web` packages in `.csproj` | Already referenced — no new packages |
| `wwwroot/img/frames/**` | Frame + mask image source files |
| `wwwroot/fonts/**` | Font source files |
| `data/uploads/` + `FileSystemAssetStorageService` | User-uploaded art resolution |

---

### Rendering Fidelity Notes

Several JS canvas operations have no single-call ImageSharp equivalent. These need custom pixel-processing extension methods in `ImageCompositeExtensions.cs`:

| JS operation | ImageSharp equivalent | Notes |
|---|---|---|
| `globalCompositeOperation = 'source-in'` | Per-pixel `ProcessPixelRows`: `result.A = min(dst.A, src.A)`, `result.RGB = src.RGB` | Critical for mask application |
| `globalCompositeOperation = 'destination-out'` | Per-pixel: `dst.A = dst.A * (1 - src.A/255)` | Used by erase frames and corner cutouts |
| `globalCompositeOperation = 'source-over'` | `DrawImage` with `PixelColorBlendingMode.Normal` | Default composite — ImageSharp's default |
| `hsl()` pixel transform | Per-pixel RGB→HSL, apply offsets, HSL→RGB | Port from `color-canvas-utilities.js` |
| `preserveAlpha` blend | Per-pixel: blend RGB using mask alpha, preserve existing alpha | Lines 688-701 in `creator-23.js` |
| Canvas `filter = 'grayscale(1)'` | `image.Mutate(x => x.Grayscale())` | For art grayscale option |
| Corner cutout with rotated `destination-out` draws | Rounded-rect clip path or per-pixel alpha mask | Port from `rendering.js` lines 106-118 |

---

### v1 Scope Boundary

**In scope** (first working version):
- Frame compositing with masks, opacity, erase, HSL, colorOverlay, preserveAlpha
- Art placement with position, zoom, rotation
- Basic text rendering (title, type, rules, P/T, mana) with inline `{i}`, `{bold}`, `{line}`, `{fontsize}`, `{fontcolor}` tags
- New standalone Razor page with JSON input → rendered PNG output
- New API endpoints for preview and full render

**Out of scope** (future phases):
- Watermarks (colorize + opacity + bounds)
- Set symbols (position/scale PNG/SVG)
- Collector/bottom info (multi-field text layout)
- Margins/bleed (integrate with existing `BleedAdder`)
- Rounded corner cutouts
- Mana symbol inline images in text
- Import/export of card JSON on the new page
- Saga/Class/Dungeon/Planeswalker special canvases
- Serial number stamps
- Guidelines and profile overlay (editor-only)
- Frame pack browser/picker UI on the new page
- Interactive art drag/zoom/rotate UI

---

### Further Considerations

1. **Canvas compositing fidelity**: The `source-in` and `destination-out` pixel ops are the highest-risk area for visual drift. Should these be unit-tested with known input images and expected output hashes? *Recommendation: Yes — create a small set of test fixtures (e.g. a 100×100 frame + mask → expected composite PNG) to validate the extension methods before integrating into the full pipeline.*

2. **Performance / caching strategy**: A full card render touches 5-15 frame images + masks (~30 image loads). `ImageResolver` should use `IMemoryCache` with a configurable max size (e.g. 200 MB) since frame/mask images are shared across all users and rarely change. Art images (user-specific, large) should NOT be cached long-term — use request-scoped disposal.

3. **Remote art fetching**: Art can be user-uploaded (local path) or a remote URL (Scryfall CDN, etc.). `ImageResolver` needs an `HttpClient` path with timeout (10s) and size limits (50 MB). Should remote art be cached to disk? *Recommendation: Yes, with hash-based dedup matching the existing `FileSystemAssetStorageService` pattern.*

4. **Frame pack migration**: The JS frame-pack definitions (e.g. `wwwroot/js/frames/packM15Regular-1.js`) define `availableFrames` arrays that the Creator UI uses for frame selection. The server render pipeline doesn't need these — it only needs the `card.frames` array from saved card JSON, which already contains resolved `src` paths. Frame pack migration is only needed if the new page wants a frame picker UI (out of v1 scope).

5. **Font handling**: Some fonts in `wwwroot/fonts/` are `.otf` format. `SixLabors.Fonts` has improving but not complete OTF support. If specific fonts fail to load, they may need one-time conversion to `.ttf`. The `FontRegistry` should log warnings for fonts that fail to load and provide a fallback.

6. **Memory management**: Each `Image<Rgba32>` at 2010×2814 is ~22 MB. A render with 15 frames + masks + art could transiently use 400+ MB. The pipeline must dispose intermediate images promptly (using `using` statements) and avoid holding multiple full-size canvases simultaneously. Consider rendering frames in streaming fashion (one at a time, composite immediately, dispose).

7. **SVG frames**: Some frames use `.svg` sources (e.g. etched masks). ImageSharp does not natively render SVG. Options: (a) pre-rasterize SVGs to PNG at build time, (b) use a library like `Svg.Skia` or `SkiaSharp` for SVG→raster conversion, (c) for v1, only support PNG/JPEG frame sources and document the SVG limitation. *Recommendation: Option (a) for v1 — add a build script that rasterizes any `.svg` frame files to `.png` at the standard card size.*

