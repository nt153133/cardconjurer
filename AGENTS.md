# AGENTS.md

## Snapshot
- `CardConjurer.csproj` is a .NET 8 ASP.NET Core app. `Program.cs` wires Razor Pages plus minimal APIs for assets, cards, card-image rendering, and import normalization.
- Primary Creator UI flow is `Pages/Creator.cshtml` with hybrid JS ownership: legacy orchestration in `wwwroot/js/creator-23.js` plus extracted domain modules in `wwwroot/js/creator/` (notably `rendering.js`, `validation-service.js`, `text-utilities.js`, `math-utilities.js`).
- Server-rendering prototype UI is `Pages/RendererV2.cshtml`, backed by `/api/render-v2/*` and `Services/CardImage/CardRenderV2Service.cs`.
- Legacy static-site files still exist at repo root (`index.html`, `css/`, `js/`, etc.) ignore these unless needed for reference.

## Fast Intent Router (Use First)

### Phrase -> first files/symbols
- `download card`, `print version`, `download output`, `overlay in download`
    - `wwwroot/js/creator-23.js`: `downloadCard(...)`, `suppressProfilePlacementOverlay`
    - `wwwroot/js/creator/rendering.js`: `drawCard(...)`
    - `Pages/Creator.cshtml`: download section, `#download-print-image`

- `margins`, `bleed`, `1/8 margin`, `margin frame`
    - `wwwroot/js/creator-23.js`: `applyMarginFrameSizing(...)`, `resetCardIrregularities(...)`, `getSelectedCardSizeMarginScale(...)`
    - `wwwroot/js/frames/groupMargin.js`: `loadMarginVersion`

- `card size profile`, `apply card size`, `load with selected size profile`
    - `wwwroot/js/creator-23.js`: `onCardSizeProfileChanged(...)`, `applyStandardCardSize(...)`, `initCardSizeSettings(...)`, `loadCardData(...)`
    - `Pages/Creator.cshtml`: `#settings-card-size-profile`, `#settings-card-width`, `#settings-card-height`, `#settings-load-override-size`

- `validation tab`, `invalid cards`, `set to selected profile`
    - `wwwroot/js/creator/validation-service.js`: `CreatorValidationService.refreshLocalValidation(...)`, `refreshServerValidation(...)`, `renderValidationResults(...)`, `setInvalidLocalCardsToSelectedProfile(...)`, `setAllLocalCardsToSelectedProfile(...)`, `loadValidationTab(...)`
    - `Pages/Creator.cshtml`: `#creator-menu-validation`, `#validation-local-results`, `#validation-server-results`
    - `css/style-9.css`: `.validation-*`

- `loaded card info`, `art url`, `create new`, `preview info box`
    - `wwwroot/js/creator/text-utilities.js`: `updateCreatorPreviewInfo(...)`, `createNewCardFromPreview(...)`
    - `wwwroot/js/creator-23.js`: `loadCardData(...)`, `artEdited(...)`
    - `Pages/Creator.cshtml`: `#creator-info-size`, `#creator-info-loaded-name`, `#creator-info-art-url`

- `text rendering`, `rules text`, `title/type font sizing`, `mana symbols in text`, `flavor bar`, `auto-size text`
    - `Card_text_analysis.md`: distilled rendering flow and replication notes (read first)
    - `wwwroot/js/creator-23.js`: `writeText(...)`, `drawText(...)`, text tag parsing and symbol placement loop
    - `wwwroot/js/creator-23.constants.js`: `getManaSymbol(...)`, mana registry constants
    - `wwwroot/js/creator/math-utilities.js`: `scaleX(...)`, `scaleY(...)`, `scaleWidth(...)`, `scaleHeight(...)`
    - `Services/CardImage/CardRenderV2Service.cs`: `DrawText(...)`, `ResolveFont(...)`, `NormalizeText(...)`

- `renderer v2`, `new render v2 page`, `server render preview`, `api/render-v2`
    - `Pages/RendererV2.cshtml`: UI wiring for saved-card load, preview, and full download
    - `Endpoints/RenderV2Endpoints.cs`: `MapRenderV2Endpoints(...)`, `POST /api/render-v2/preview`, `POST /api/render-v2/full`
    - `Services/CardImage/CardRenderV2Service.cs`: `RenderAsync(...)`, `DrawArtAsync(...)`, `DrawFramesAsync(...)`, `DrawText(...)`

## Domain Glossary (Canonical Terms)
- **Cut size**: saved `width` x `height` without margins.
- **Bleed size**: rendered size with margins (`cut * (1 + 2 * margin)`).
- **Safe size**: inner text-safe region from selected profile (`profile.safe`).
- **Margin frame**: mode where `card.margins = true` and margins/bleed are active.
- **Print image**: download mode including bleed (`#download-print-image`).
- **Profile overlay**: editor guide (cut/safe) that is suppressed in final download output.

## Where To Look First
- App startup/routes: `Program.cs`
- Creator markup: `Pages/Creator.cshtml`
- Creator modules (domain-first): `wwwroot/js/creator/`
- Main Creator orchestration/legacy glue: `wwwroot/js/creator-23.js`
- Text rendering deep dive: `Card_text_analysis.md`
- Renderer V2 page + API + service: `Pages/RendererV2.cshtml`, `Endpoints/RenderV2Endpoints.cs`, `Services/CardImage/CardRenderV2Service.cs`
- Shared layout: `Pages/Shared/_Layout.cshtml`
- Asset APIs/storage: `Endpoints/AssetEndpoints.cs`, `Services/Assets/FileSystemAssetStorageService.cs`, `Models/Assets/*`
- Import normalization: `Endpoints/ImportNormalizationEndpoints.cs`, `Services/ImportNormalization/CardImportNormalizationService.cs`, `Models/ImportNormalization/ImportNormalizationContracts.cs`

## Module Ownership Map (`wwwroot/js/creator`)
- `rendering.js`: final card compositing and overlays; start with `drawCard(...)`, `drawProfilePlacementOverlay(...)`, `setRoundedCorners(...)`.
- `validation-service.js`: card-size validation and bulk-fix flows; start with `CreatorValidationService.loadValidationTab(...)`, `refreshLocalValidation(...)`, `setInvalidLocalCardsToSelectedProfile(...)`.
- `text-utilities.js`: creator preview info/sidebar helpers; start with `updateCreatorPreviewInfo(...)`, `createNewCardFromPreview(...)`.
- `math-utilities.js`: coordinate scaling and canvas sizing; start with `scaleX(...)`, `scaleY(...)`, `scaleWidth(...)`, `scaleHeight(...)`, `sizeCanvas(...)`.
- `card-storage.js`: local/server saved-card orchestration; start with `CreatorCardStorageService` methods.
- `frameTab.js`: frame pack/frame/mask tab interactions; start with `loadFramePacks(...)`, `loadFramePack(...)`, `frameOptionClicked(...)`, `maskOptionClicked(...)`.
- `set-symbol-tab.js`: set symbol upload/library/load/draw; start with `uploadSetSymbol(...)`, `fetchSetSymbol(...)`, `drawSetSymbol(...)`.
- `watermark-tab.js`: watermark upload/library/colorization; start with `uploadWatermark(...)`, `watermarkEdited(...)`, `getSetSymbolWatermark(...)`.
- `collector-tab.js`: collector info + serial text flows; start with `loadBottomInfo(...)`, `bottomInfoEdited(...)`, `serialInfoEdited(...)`, `resetSerial(...)`.
- `resource-loaders.js`: URL/file/script/SVG loading helpers; start with `imageURL(...)`, `imageLocal(...)`, `loadScript(...)`, `stretchSVG(...)`.
- `asset-library.js`: shared asset-library fetch/render/upload helpers used by symbol/watermark flows.
- `asset-loading.js`: async load trackers (`ImageLoadTracker`, `FontLoadTracker`) and settle waits.
- `drag-drop.js`: drag/touch reorder behavior for creator lists.
- `shell-helpers.js`: creator shell/tab/name helpers; start with `toggleCreatorTabs(...)`, `getInlineCardName(...)`.
- `color-canvas-utilities.js`: color/HSL/canvas utility helpers shared by rendering and watermarking.

Text rendering parity note:
- For any text behavior change (font sizing, tags, rules wrapping, symbol placement), read `Card_text_analysis.md` first, then inspect `writeText(...)`/`drawText(...)` in `wwwroot/js/creator-23.js`, and finally apply parity updates in `Services/CardImage/CardRenderV2Service.cs`.

## Triage Rule For Creator Requests
1) Confirm target UI element ID exists in `Pages/Creator.cshtml`.
2) Confirm matching selector/function exists in domain modules under `wwwroot/js/creator/` first, then in `wwwroot/js/creator-23.js` for remaining glue/legacy paths.
3) Confirm CSS class/layout behavior in `css/style-9.css`.
4) For text behavior, check `Card_text_analysis.md` and `writeText(...)` before changing server parity logic.
5) Check for feature interactions (size profile, margin frame, overlay suppression, validation caches).

## Architecture And Data Flow
- Creator uses direct `fetch(...)` calls to server APIs (assets/cards/import normalization/card-image).
- Asset uploads are filesystem-backed (`data/uploads`), served via `/user-content`.
- Art uploads use hash-based duplicate detection (`409`) in `FileSystemAssetStorageService`.
- `POST /api/cards/prepare-localstorage-upload` preserves raw client card JSON plus normalized import payload.

## Project-Specific Conventions
- Creator remains JS-driven and markup-heavy; prefer placing new domain logic in `wwwroot/js/creator/*.js` modules, keeping `creator-23.js` for orchestration/compatibility unless extraction is out of scope.
- For user-facing static assets referenced by Razor (`/js`, `/css`, `/img`), update `wwwroot/` first; mirror legacy root copies if needed.
- Preserve Scryfall contract field names via `[JsonPropertyName(...)]`.
- Import normalization style is regex/string transform oriented; match existing style.
- **Changelog discipline**: every major feature/behavior change/user-visible fix must add one entry in `CHANGELOG.md` in the same PR/commit.
- **Changelog format**: 1-2 lines per entry under `## Unreleased` -> `Added` / `Changed` / `Fixed`.

## Local Workflows
- Primary run path:
```powershell
dotnet run
```
• Useful verification:
dotnet build
docker compose up -d
• Fast API smoke tests: asset-upload.http, import-normalization.http
• No dedicated test project currently; at minimum run build + manual affected flow checks.

Debugging Notes
• launcher.py is legacy static hosting and does not exercise ASP.NET minimal APIs.
• wwwroot/local_art/ is a bypass path for large local images and is merged into art-source listing.
• If asset behavior looks wrong, inspect both storage config in appsettings.json and path/URL normalization in FileSystemAssetStorageService.