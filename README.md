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
