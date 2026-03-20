# AGENTS.md

## Snapshot
- `CardConjurer.csproj` is a .NET 8 ASP.NET Core app. `Program.cs` wires Razor Pages plus minimal APIs for assets, cards, card-image rendering, and import normalization.
- Primary UI flow is `Pages/Creator.cshtml` + `wwwroot/js/creator-23.js`.
- Legacy static-site files still exist at repo root (`index.html`, `css/`, `js/`, etc.) ignore these unless needed for reference.

## Fast Intent Router (Use First)

### Phrase -> first files/symbols
- `download card`, `print version`, `download output`, `overlay in download`
    - `wwwroot/js/creator-23.js`: `downloadCard(...)`, `drawCard(...)`, `suppressProfilePlacementOverlay`
    - `Pages/Creator.cshtml`: download section, `#download-print-image`

- `margins`, `bleed`, `1/8 margin`, `margin frame`
    - `wwwroot/js/creator-23.js`: `applyMarginFrameSizing(...)`, `resetCardIrregularities(...)`, `getSelectedCardSizeMarginScale(...)`
    - `wwwroot/js/frames/groupMargin.js`: `loadMarginVersion`

- `card size profile`, `apply card size`, `load with selected size profile`
    - `wwwroot/js/creator-23.js`: `onCardSizeProfileChanged(...)`, `applyStandardCardSize(...)`, `initCardSizeSettings(...)`, `loadCardData(...)`
    - `Pages/Creator.cshtml`: `#settings-card-size-profile`, `#settings-card-width`, `#settings-card-height`, `#settings-load-override-size`

- `validation tab`, `invalid cards`, `set to selected profile`
    - `wwwroot/js/creator-23.js`: `refreshLocalValidation(...)`, `refreshServerValidation(...)`, `renderValidationResults(...)`, `setInvalidLocalCardsToSelectedProfile(...)`, `setAllLocalCardsToSelectedProfile(...)`
    - `Pages/Creator.cshtml`: `#creator-menu-validation`, `#validation-local-results`, `#validation-server-results`
    - `css/style-9.css`: `.validation-*`

- `loaded card info`, `art url`, `create new`, `preview info box`
    - `wwwroot/js/creator-23.js`: `updateCreatorPreviewInfo(...)`, `createNewCardFromPreview(...)`, `loadCardData(...)`, `artEdited(...)`
    - `Pages/Creator.cshtml`: `#creator-info-size`, `#creator-info-loaded-name`, `#creator-info-art-url`

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
- Main Creator behavior: `wwwroot/js/creator-23.js`
- Shared layout: `Pages/Shared/_Layout.cshtml`
- Asset APIs/storage: `Endpoints/AssetEndpoints.cs`, `Services/Assets/FileSystemAssetStorageService.cs`, `Models/Assets/*`
- Import normalization: `Endpoints/ImportNormalizationEndpoints.cs`, `Services/ImportNormalization/CardImportNormalizationService.cs`, `Models/ImportNormalization/ImportNormalizationContracts.cs`

## Triage Rule For Creator Requests
1) Confirm target UI element ID exists in `Pages/Creator.cshtml`.
2) Confirm matching selector/function exists in `wwwroot/js/creator-23.js`.
3) Confirm CSS class/layout behavior in `css/style-9.css`.
4) Check for feature interactions (size profile, margin frame, overlay suppression, validation caches).

## Architecture And Data Flow
- Creator uses direct `fetch(...)` calls to server APIs (assets/cards/import normalization/card-image).
- Asset uploads are filesystem-backed (`data/uploads`), served via `/user-content`.
- Art uploads use hash-based duplicate detection (`409`) in `FileSystemAssetStorageService`.
- `POST /api/cards/prepare-localstorage-upload` preserves raw client card JSON plus normalized import payload.

## Project-Specific Conventions
- Creator remains JS-driven and markup-heavy; keep logic in `creator-23.js` unless server behavior is required.
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