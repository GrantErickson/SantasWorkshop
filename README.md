# Santa's AI Workshop

A booth experience for the Innovate Inland Northwest Christmas party. A guest tells Santa's AI Elf the one work task
they wish would disappear. Within seconds they get:

- **A toy blueprint**: a silly, illustrated elf machine that does the job, drawn as an engineering blueprint.
- **A real answer**: how AI could actually handle that task, a pilot to try first, and an estimate of hours saved per year.
- **A take-home QR code**: opens their card on their phone, where they can opt in to a personalized 90-day AI starter plan
  by email (that's the lead capture).

Meanwhile the TVs show every (anonymized) wish scrolling live, and a running count of the hours the region could get back.

ASP.NET Core (.NET 10) with plain HTML/JS pages. Claude (via the official Anthropic C# SDK) writes the blueprints,
answers and starter plans.

## Screens

| URL | Where | What |
|---|---|---|
| `/kiosk` | Tablet at the booth | Guests type (or speak) a wish and see the result. Resets itself when idle. |
| `/wall` | TV 1 | Scrolling "I wish AI would…" list, rotating featured blueprint, a takeover animation for each new wish. |
| `/counter` | TV 2 | Giant hours odometer, fun equivalents, and hours by kind of wish. |
| `/c/{id}` | Guest's phone (from the QR code) | Their blueprint and answer, plus the starter-plan opt-in form. |
| `/admin` | Staff laptop/phone | Status, screen links, hide wishes from the wall, leads, follow-up emails, CSV export. |

The wall and counter update live over server-sent events. Either TV page also works alone if you only have one TV
(the wall shows the hours total in its corner).

## Run it locally

```powershell
cd src/SantasWorkshop
dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."
dotnet run
```

Open http://localhost:5284. In Development the admin key is `elf-admin`.

Without an API key the app still works: it uses the **backup elf**, a set of hand-written templates matched by
keywords. The same fallback kicks in automatically if Claude is slow or unreachable on the night, so the kiosk never
shows an error.

## Hosting

Guests' phones must be able to open the QR code link, so the site needs a public address. HTTPS also turns on the
kiosk's microphone button.

### Our deployment: Azure App Service

The booth runs at **https://intellitect-santa.azurewebsites.net**.

| | |
|---|---|
| Subscription | Microsoft Partner Azure Sponsorship (IntelliTect Entra tenant) |
| Resource group | `intellitect-santa`, which holds only this site |
| App Service plan | `CoalesceAppServicePlan` (Windows, P1v3) in `CoalesceResourceGroup`. It's shared with other IntelliTect sites, so the booth costs nothing extra. |
| Site | `intellitect-santa`: .NET 10, 64-bit, Always On, HTTPS only |

**To deploy a change**, sign in with `az login` using your IntelliTect account, then run this from the repo root in
PowerShell:

```powershell
./deploy.ps1
```

It builds a Release copy, uploads it, and checks that the site answers. Guests' data in `App_Data/` is never
included. On the server, wishes and leads live in `D:\home\data`, which survives deploys and restarts. A deploy
restarts the site: the TVs reconnect on their own, but a wish in progress on the kiosk would fail, so avoid deploying
in the middle of the party.

**Settings and secrets** are set in the Azure portal (the site's **Settings → Environment variables** page), never in
this repo, which is public. Changing one restarts the site. Double underscores are how .NET reads nested settings
from environment variables.

- `ANTHROPIC_API_KEY`
- `Workshop__AdminKey`: the password for `/admin`
- `Workshop__KioskKey`: only a kiosk opened with `?key=...` can submit wishes and spend API credits. The admin page's
  Screens panel shows the unlocked kiosk link and its QR code.
- `Workshop__PublicBaseUrl`: `https://intellitect-santa.azurewebsites.net`
- `Workshop__DataDirectory`: `D:\home\data`

**To set it up again from scratch** (only needed if the site was deleted), run this in PowerShell. The site has to be
in West US, the plan's region:

```powershell
$sub = "Microsoft Partner Azure Sponsorship"; $rg = "intellitect-santa"; $app = "intellitect-santa"
$plan = az appservice plan show --subscription $sub -g CoalesceResourceGroup -n CoalesceAppServicePlan --query id -o tsv
az group create --subscription $sub -n $rg -l westus
az webapp create --subscription $sub -g $rg -p $plan -n $app --runtime "dotnet:10"
az webapp update --subscription $sub -g $rg -n $app --https-only true
az webapp config set --subscription $sub -g $rg -n $app --always-on true --use-32bit-worker-process false --ftps-state Disabled
az webapp config appsettings set --subscription $sub -g $rg -n $app --settings `
  "Workshop__PublicBaseUrl=https://$app.azurewebsites.net" 'Workshop__DataDirectory=D:\home\data'
```

Then add `ANTHROPIC_API_KEY`, `Workshop__AdminKey` and `Workshop__KioskKey` in the portal and run `./deploy.ps1`.

**After the party**, download the leads CSV from admin first, because deleting the site deletes its data. Then remove
the booth. This deletes only the booth's resource group; the shared plan and its other sites stay.

```powershell
az group delete --subscription "Microsoft Partner Azure Sponsorship" -n intellitect-santa
```

### Other ways to host it

**Another host.** Anything that runs .NET 10 works. Run a **single instance** (wishes are kept in memory and in a
JSON file), set the settings above, keep it always on so the live TV connections aren't dropped, and point
`Workshop__DataDirectory` at storage that survives restarts (for example `/home/data` on Linux App Service).

**A laptop on the venue Wi-Fi.**

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:Workshop__AdminKey = "pick-a-secret"
$env:Workshop__KioskKey = "pick-another-secret"
dotnet run --project src/SantasWorkshop --launch-profile booth
```

Open `/admin` using the laptop's network address (e.g. `http://192.168.1.20:5284/admin`), not `localhost`, so QR codes
point somewhere phones can reach. Allow the app through Windows Firewall when prompted. Caveats: guests must be on the
same Wi-Fi (many venues isolate clients), and the microphone button only appears over HTTPS.

## Day-of checklist

1. Open `/admin` and check **Elf brain** says *Claude ✓*. Make a test wish and check the time it took.
   If it's much over 20 seconds, set `Workshop__UseFastMode=true` (faster, about twice the price per token).
2. Scan the kiosk QR code in the Screens panel with the tablet. It opens the kiosk already unlocked.
   On an iPad, *Share → Add to Home Screen* gives a full-screen kiosk. Turn on Guided Access to lock it in.
3. Open `/wall` and `/counter` full screen (F11) on the TVs, then **click once on each one** to turn on sound.
   Browsers won't play audio until someone clicks, so each TV shows a "Click anywhere for sound" button until you do.
   On the TVs, **S** toggles all sound and **M** toggles the wall's music. The kiosk has a speaker button in its top
   corner, and its sound starts with the first guest's tap. On an iPad, check the silent switch is off.
4. Make one wish, scan its QR code with your own phone, and submit the opt-in form to test the whole loop.
   Then hide that test wish in admin so it isn't on the wall.
5. Keep `/admin` open on a phone. Use **Hide** if anything unfortunate makes it onto the wall.

## Settings (`Workshop` section of appsettings.json)

| Setting | Default | Notes |
|---|---|---|
| `CompanyName`, `CompanyUrl` | IntelliTect | Shown on screens, blueprints and emails. |
| `LogoUrl` | *(empty)* | Optional logo image (e.g. drop a file in `wwwroot/img/` and use `/img/logo.svg`). Text wordmark otherwise. |
| `EventName`, `RegionName` | Innovate Inland Northwest… | Used in the copy and the prompts. |
| `BuiltInDays` | 2 | "We built this booth with AI in N days." |
| `StartingHours` | 0 | Added to the hours counter. |
| `PublicBaseUrl` | *(request URL)* | Base for QR codes and email links. |
| `AdminKey` | *(empty = admin off)* | `elf-admin` in Development. |
| `KioskKey` | *(empty = open)* | Open the kiosk once with `/kiosk?key=...`; the tablet remembers it. |
| `DataDirectory` | `App_Data` | Where `wishes.json` and `leads.json` live. |
| `Model` | `claude-opus-5-5` | |
| `Effort` | `low` | `low` / `medium` / `high`. Low keeps answers fast. |
| `UseFastMode` | false | Opus 5.5 fast mode; falls back to standard speed if rate limited. |
| `ClaudeTimeoutSeconds` | 40 | After this, the backup elf answers instead. |
| `UseBackupElfOnly` | false | Never call Claude. |

## How Claude is used

- **One call per wish** (`Services/ElfService.cs`, prompts in `Services/ElfPrompts.cs`) with a strict JSON schema
  (structured outputs). Claude returns the blueprint (a name, a tagline, 4–5 machine parts from a fixed catalog, and a
  warning label), the practical answer, an hours estimate with its assumptions, a category, an anonymized line for the
  wall, and an `appropriate` flag. Unsuitable wishes get a friendly "Ho ho… no!" on the kiosk and never reach the wall.
- **The blueprint drawing is code, not image generation.** `wwwroot/js/blueprint.js` draws each part Claude picks
  (33 of them), on one of several machine shapes with its own motion and pipe fittings, seeded from the wish so it
  always draws the same way. That keeps every card on-brand and instant. To add a part, add it to `Catalog.Modules`,
  `PARTS` in blueprint.js, and `PART_SOUND` in `wwwroot/js/sound.js`.
- **The music and sound effects are synthesized in the browser** (`wwwroot/js/sound.js`), so there are no audio files.
  The music is arranged from public-domain carols. The wall plays music and a fanfare for each new wish, the kiosk
  plays effects and a jingle while the elves work, and the counter ticks and cha-chings as the hours go up. When a
  blueprint appears, each part lights up and makes its own noise, left to right.
- **One call per lead**, in the background, writes the personalized starter plan.
- **Server-side refusal fallback** (`server-side-fallback-2026-07-01` beta) is on: if a safety classifier declines
  a request, the API retries it on a fallback model inside the same call. Anything else that fails drops to the backup elf.

## Follow-up emails

Leads appear in **admin → Leads** with their plan once it's written (a few seconds). For each one: **Email** opens a
preview → **Copy formatted email** → paste into a new Outlook message → tick **Sent**. **Download CSV** exports
everything, including the plain-text email body, if you'd rather do a mail merge.

## Data and privacy

`App_Data/` holds guests' original wishes and contact details. It is gitignored. Delete it once follow-up is done.
The public wall only ever shows the anonymized line. The phone card is reachable only through its unguessable link.
