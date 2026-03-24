# CHANGELOG

All notable product-facing changes should be added here.

## Unreleased

### Added
- `ISvgRasterizationService` + `SvgRasterizationService`: two-tier SVG rasterization service using VectSharp. Tier 1 caches parsed SVG `Page` objects indefinitely; Tier 2 caches rasterized `Image<Rgba32>` mana symbols in `IMemoryCache` with auto-dispose on eviction. Includes uncached frame rasterization for large card SVGs, per-key locks to prevent duplicate work, and a startup scan of `wwwroot/img/manaSymbols/` for symbol resolution.
- Renderer V2: wired the "Load saved card" dropdown to `/api/cards` so server-saved cards populate on page load; selecting a card now fetches its full details and loads only the inner `cardJson` into the JSON textarea, ready to be sent to the render preview/download endpoints.
- `Card_text_analysis.md`: detailed analysis of the JS text rendering pipeline (`writeText()`) covering font sizing, textbox layout, tag processing, mana symbol rendering, auto-size shrink loop, and vertical centering — with ImageSharp replication notes for the server renderer.

### Fixed
- Render V2 / `CardData`: expanded creator-save deserialization coverage for mana text fields (`manaPrefix`, `manaSpacing`, `manaLayout`, `manaPlacement`, shadow/outline/rotation settings), vector frame metadata (`stretch`, `ogBounds`, `complementary`, `noDefaultMask`, mask `preserveAlpha`), and version payloads (`planeswalker`, `dungeon`, `qrCode`, `station`) so more saved cards can be read back intact by `/api/render-v2/*`.
- Renderer V2 / `CardData`: legacy saved cards that serialize `serialX`, `serialY`, or `serialScale` as empty strings (`""`) now deserialize safely as `null` instead of throwing `JsonException` (while still rejecting non-empty invalid numeric strings).
- Renderer V2 font lookup: font names like `belerenb` / `belerenbsc` (CSS-style, no separators) now correctly resolve to `beleren-b.ttf` / `beleren-bsc.ttf`. Each font now registers both its raw filename alias and a separator-stripped alias (`-`, `_`, spaces removed) at load time; `ResolveFont` applies the same stripping to the requested name before lookup, preventing the silent fallback to the first loaded system font.
- Renderer V2 text color: text blocks with no explicit `color` field (title, type, rules, pt in standard card JSON) now default to `Color.Black` instead of `Color.White` — matching real card ink on light/coloured title and rules areas. Blocks that need white continue to work because they explicitly set `"color":"white"`. Also downgraded the associated log from `Error` to `Debug` since a missing color is expected, not exceptional.
- Renderer V2 / `CardData`: `FromJsonElement` was returning `null` (→ "Invalid cardJson payload.") for real saved cards due to two deserialization mismatches: (1) JS card objects sometimes store numbers as strings (`artRotate:"0"`, `infoYear:"2026"`) — fixed by adding `JsonNumberHandling.AllowReadingFromString`; (2) `bottomInfo` is a keyed object `{midLeft:{...}}` in stored cards, not a JSON array — fixed by changing its type from `List<JsonElement>?` to `JsonElement?`.
- Server-rendering prototype: added standalone `Renderer V2` page (`/renderer-v2`) and `POST /api/render-v2/preview|full` endpoints to test a separate C# image pipeline for frame/art/text rendering from card JSON.
- Import/Save: added `Download All Images (Print Bleed)` button that bulk-renders all saved cards through the server renderer with `isPrintImage: true` and saves them as a ZIP.
- Validation workflow in Creator: added a `Validation` tab and local/server validation result sections wired to existing validation logic.
- Validation bulk-fix actions: added buttons to update invalid local cards or all local saved cards to the currently selected size profile.

### Changed
- Import normalization: migrated client-side `processScryfallCard` to server; `fetchScryfallData`, `fetchScryfallCardByID`, and `fetchScryfallCardByCodeNumber` now delegate face-expansion and language normalization to `POST /api/import-normalization/process-scryfall-card(s)`. Added batch `process-scryfall-cards` endpoint for multi-result search responses. Also fixed a scope bug where the two single-card fetchers incorrectly referenced `unique`/`cardName`/`cardLanguageSelect` from the wrong closure.
- Import normalization: moved Creator import parse paths to server endpoints (`/from-text`, `/saga`, `/class`, `/roll`, `/station`, `/multi-faced`, `/layout-specific`) and replaced local parser implementations in `creator-23.js` with async API wrappers. Added `AbortController` support to cancel in-flight parse requests when import card index selection changes rapidly.
- Frame tab UI and autoFrame logic extracted into modular files: `frameTab.js` (frame picker UI), `autoFrameLogic.js` (frame type selection), `autoFrameVariants.js` (frame-specific variants), `autoFrameHelpers.js` (frame layer builders) for improved maintainability.
- Creator preview info strip: added an under-canvas box showing current size, loaded saved name, and art URL, plus a `Create New` action button.
- Card size profile controls in Frame: restored profile selector, width/height inputs, apply/reset actions, and load override toggle.
- Print download option: added `Download print version (includes bleed)` toggle and wired it to server render payload.
- Git history import: added card import normalization service (`f763650`, `feat(import-normalization)`).
- Git history import: implemented server-side asset upload functionality (`21882f4`, `feat(assets)`).
- Git history import: added endpoints for listing uploaded assets (`afba760`, `feat(assets)`).
- Git history import: implemented asset library management features (`ed99014`, `feat(asset-library)`).
- Git history import: implemented card storage and management features (`945ae03`, `feat(cards)`).
- Git history import: implemented card image rendering endpoints and service (`752ffd8`, `feat(card-image)`).
- Git history import: added standard card size settings and related canvas functionality (`580a5f3`, `feat(canvas)`).
- Git history import: enhanced Docker configuration to support asset management flows (`cfe7b82`, `feat(docker)`).
- Git history import: added card size profile management and processing for rendering (`89829f9`, `feat(card-image)`).

### Changed
- Creator script structure: started hybrid split by moving core draw/guideline/profile-overlay/rounded-corner rendering functions into `wwwroot/js/creator/rendering.js` while keeping current inline handlers via global bridge.
- Creator script structure: split local/server saved-card management into `wwwroot/js/creator/card-storage.js` (`CreatorCardStorageService`) and converted `creator-23.js` storage functions to compatibility delegates.
- Creator script structure: split validation/profile-match logic into `wwwroot/js/creator/validation-service.js` (`CreatorValidationService`) and converted `creator-23.js` validation functions to compatibility delegates.
- Creator script structure: moved Set Symbol tab behavior and `drawSetSymbol(...)` into `wwwroot/js/creator/set-symbol-tab.js` and kept existing tab handlers unchanged.
- Creator script structure: moved Watermark tab behavior (upload/select/edit/reset and set-code SVG watermark import) into `wwwroot/js/creator/watermark-tab.js`.
- Creator script structure: moved Collector tab behavior (bottom info style/rendering, serial controls, artist sync, and collector defaults/toggles) into `wwwroot/js/creator/collector-tab.js`.
- Creator script structure: applied safe Frame-tab follow-up split (`wwwroot/js/creator/frameTab.js`) as namespaced picker helpers only, avoiding runtime overrides like `addFrame(...)`.
- Creator script structure: centralized asset server upload/list/select operations into `wwwroot/js/creator/asset-library.js` and delegated art/frame/set-symbol/watermark library calls to it.
- Creator script structure: cleanup pass moved Asset Library tab state/UI actions (`switch/load/select-all/deselect/delete/upload`) into `wwwroot/js/creator/asset-library.js` with compatibility delegates in `creator-23.js`.
- Creator script structure: extracted asset-loading trackers, preview-info/text helpers, shell/tab helpers, image/script loader helpers, and canvas sizing/scaling helpers into `wwwroot/js/creator/asset-loading.js`, `text-utilities.js`, `shell-helpers.js`, `resource-loaders.js`, and `math-utilities.js`, and removed the duplicated implementations from `creator-23.js`.
- Import/Save download and upload controls regrouped into paired action cards: image downloads (both normal and print-bleed) on one side, cards-file download and upload on the other.
- Frame options layout: grouped `Rounded Corners`, `Guidelines`, and `Transparencies` on one line and added `Show Cut/Safe Overlay` toggle.
- Validation review output now renders as spaced flowing cards with structured details instead of dense unseparated text.
- Profile placement overlay behavior: mode-aware rendering now draws safe only in cut mode, and cut + safe in bleed mode.
- Download rendering behavior: profile overlay remains visible in editor preview but is suppressed during output generation.
- Card-size updates now automatically reapply an active Margin frame after `Apply card size` and load-with-selected-size-profile flows.
- Loading with `Use selected size profile when loading cards` now notifies when a card's saved size is overridden to the selected profile size.

### Fixed
- Text editing no longer throws on missing textbox font sizes, and autoframe no longer reloads frame packs on each keystroke when key text fields are absent.
- Creator startup stability: guarded optional DOM lookups (`#autoFrame`, `#autoframe-always-nyx`, `#art-update-autofit`) to prevent null-reference crashes.
- Restored grouped Import/Save local-vs-server action card markup and frame helper grid class after partial revert.
- Frame tab behavior: restored frame preview rendering, frame-list labels, drag/reorder, and frame settings interactions by avoiding conflicting `addFrame(...)` overrides.
- Frame group bootstrap: restored global `loadFramePacks`/`loadFramePack` availability and script ordering so default frame-group scripts load correctly during Creator startup.
- Autoframe helper extraction hardening: Creator now verifies `make*FrameByLetter` helpers are loaded before dispatch, showing a clear reload prompt instead of failing with undefined-function runtime errors.
