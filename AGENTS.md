# AGENTS.md

## Snapshot
- `CardConjurer.csproj` is a .NET 8 ASP.NET Core app. `Program.cs` wires Razor Pages plus two singleton-backed minimal API areas: asset storage and import normalization.
- The current server-rendered app serves Razor pages from `Pages/` and static files from `wwwroot/`. The main user flow is `Pages/Creator.cshtml` + `wwwroot/js/creator-23.js`.
- This repo also still contains the older static-site layout at the project root (`index.html`, `creator/`, `js/`, `css/`, etc.). `.github/workflows/publish.yaml` syncs the whole repo to S3, so those legacy files are still relevant.

## Where to look first
- App startup and route registration: `Program.cs`
- Creator UI markup: `Pages/Creator.cshtml`
- Shared shell/layout: `Pages/Shared/_Layout.cshtml`
- Main creator behavior: `wwwroot/js/creator-23.js` (root `js/creator-23.js` is a near-mirror)
- Asset API + storage rules: `Endpoints/AssetEndpoints.cs`, `Services/Assets/FileSystemAssetStorageService.cs`, `Models/Assets/*`
- Import normalization API + contracts: `Endpoints/ImportNormalizationEndpoints.cs`, `Services/ImportNormalization/CardImportNormalizationService.cs`, `Models/ImportNormalization/ImportNormalizationContracts.cs`

## Architecture and data flow
- UI actions in the creator call server APIs directly with `fetch(...)`; examples in `creator-23.js` include `/api/assets/upload/{kind}`, `/api/assets/art-sources`, `/api/assets/sources/set-symbols`, and `/api/assets/{kind}`.
- Asset uploads are persisted on disk, not in a database. Default root is `data/uploads`, served back under `/user-content` via the extra `UseStaticFiles(...)` registration in `Program.cs`.
- Art uploads are special: `FileSystemAssetStorageService` hashes art with SHA-256, rejects duplicates with `409`, and stores files as `hash_originalName.ext`.
- Import-normalization logic is server-side C# that mirrors former client parsing behavior; keep request/response shapes aligned with Scryfall-like JSON contracts in `Models/ImportNormalization/ImportNormalizationContracts.cs`.
- `POST /api/cards/prepare-localstorage-upload` is an adapter endpoint: it preserves raw client card JSON while attaching normalized imported-card data for future persistence.

## Project-specific conventions
- Treat the creator page as markup-heavy and JS-driven: most behavior lives in `creator-23.js`, while `Pages/Creator.cshtml.cs` is intentionally minimal.
- If you change a user-facing static asset referenced by Razor (`/js/...`, `/css/...`, `/img/...`), update the `wwwroot/` copy first. Check whether the matching root-level legacy file also needs the same change to keep the static/S3 path in sync.
- When adding a new asset kind, update all of: `Models/Assets/AssetKinds.cs`, storage/list/delete behavior, and any creator dropdown/library code that fetches `/api/assets/...`.
- Preserve existing JSON field names from Scryfall contracts via `[JsonPropertyName(...)]`; do not “clean up” names to C# casing only.
- The import-normalization service uses plain regex/string transforms, not external parsers. Match that style when extending layout-specific parsing.

## Local workflows
- Primary local run path from `README.md`:
```powershell
dotnet run
```
- Useful verification commands:
```powershell
dotnet build
docker compose up -d
```
- The checked-in request files `asset-upload.http` and `import-normalization.http` are the fastest way to smoke-test the server APIs.
- No dedicated test project was found. After changes, at minimum run `dotnet build` and manually exercise the affected page/API flow.

## Debugging notes
- `launcher.py` is a legacy static file server for the old site layout; it will not exercise the ASP.NET minimal APIs that current uploads/import endpoints depend on.
- `wwwroot/local_art/` is a special bypass for large local images; the asset API also merges those files into `GET /api/assets/art-sources`.
- If an upload or asset list looks wrong, inspect both the configured `Storage` values in `appsettings.json` and the normalized URL/path handling in `FileSystemAssetStorageService`.
