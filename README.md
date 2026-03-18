# Card Conjurer
Card Conjurer was created by a passionate Magic the Gathering player and grew to become probably the most popular online card generator known to the game.
In November of 2022, Wizards of the Coast served the original creator and webhost of the site with Ceas and Desist paperwork, forcing the site offline.
This repository is for the purpose of making the application usable on your local machine and maintaining templates in perpetuity.

## ASP.NET Core Server

This project runs on an ASP.NET Core server (.NET 8.0). The Card Creator page and all static assets are served through ASP.NET Core Razor Pages.

### Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) (or later)

### Run Locally

```bash
dotnet run
```

The application will start at `http://localhost:5000` by default. Navigate to `/creator` for the Card Creator page.

### Import Normalization APIs (new)

Parser and import-normalization logic from `creator-23.js` now has server-side endpoints under `/api/import-normalization`:

- `POST /api/import-normalization/from-text`
- `POST /api/import-normalization/saga`
- `POST /api/import-normalization/class`
- `POST /api/import-normalization/roll`
- `POST /api/import-normalization/station`
- `POST /api/import-normalization/process-scryfall-card`
- `POST /api/import-normalization/multi-faced`
- `POST /api/import-normalization/layout-specific`

For future server-side card storage (while keeping localStorage), there is also:

- `POST /api/cards/prepare-localstorage-upload`

That endpoint returns a versioned envelope (`schemaVersion`) with raw client JSON and normalized import data, so a persistence layer can be added later without changing the client payload shape.

### Asset Upload API (server-side storage)

The app can now store uploaded user assets on disk under a configurable folder and serve them back over HTTP.

- `POST /api/assets/upload/{kind}` using `multipart/form-data`
- `file` form field is required
- Supported `{kind}` values: `art`, `frames`, `set-symbols`, `watermarks`, `misc`
- `GET /api/assets/sources/{kind}` lists uploaded files for that kind (used by set symbol and watermark dropdowns)
- `GET /api/assets/art-sources` lists both `wwwroot/local_art` files and uploaded `art` files for UI dropdown selection
- `DELETE /api/assets/{kind}` deletes an uploaded file by public URL (JSON body: `{ "url": "..." }`)

Creator-side uploads now use server storage for:

- Art
- Custom frame images
- Set symbols
- Watermarks

The Creator now also includes an **Asset Library** tab for uploaded images with:

- type filtering (`art`, `frames`, `set-symbols`, `watermarks`)
- multi-file upload
- thumbnail browsing
- select all / deselect all
- batch delete

Art uploads are de-duplicated by file hash (SHA-256):

- if an uploaded art file hash already exists, upload returns `409 Conflict`
- accepted art files are stored as `hash_(originalFilename).ext`
- custom-image dropdowns display concise filenames (hash/path prefixes are hidden)

By default, files are written under `data/uploads` and served from `/user-content`.

Config keys in `appsettings.json`:

- `Storage:UploadsRoot`
- `Storage:PublicBasePath`

If you run with Docker and want uploads to persist, mount your host folder to the configured uploads root path.

### Run with Docker

```bash
docker compose up -d
```

Open your browser to `http://localhost:8080/`.


[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?longCache=true&style=popout)](https://www.paypal.me/kyleburtondonate
) ← Help out Card Conjurer's original creator, Kyle. We love you buddy.


## Using Local Images

If you're saving a lot of cards custom images you might hit the data limit for uploaded images (about 2MB).

You can avoid this by putting the image files in the `wwwroot/local_art` directory of this repo. Then, when selecting the image in the Art tab of the card creator, instead of uploading the image you can type the file name in the "Via URL" field. This will use the image directly from the `local_art` directory instead of needing to store the whole image in the save file.

For example if you add the file:
`wwwroot/local_art/my_art.jpg`

You can load it in the "Via URL" box by typing:
`my_art.jpg`
then hitting enter.
