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

## Booth night: pick a hosting option

Guests' phones must be able to open the QR code link, so the site needs an address they can reach.

**Option A: host it publicly (recommended).** Deploy to Azure App Service (or anything that runs .NET 10). QR codes
work over cellular, and HTTPS enables the kiosk's microphone button. Then:

- Run a **single instance** (wishes are kept in memory and in a JSON file).
- Set these app settings (double underscores are how .NET reads nested settings from environment variables):
  - `ANTHROPIC_API_KEY`
  - `Workshop__AdminKey`: any long secret
  - `Workshop__KioskKey`: any secret, so only your tablet can submit wishes and spend API credits
  - `Workshop__PublicBaseUrl`: e.g. `https://santa.example.com`
  - `Workshop__DataDirectory`: a writable, persistent folder, e.g. `/home/data` on Linux App Service
    (the deployed site folder can be read-only)
- Turn on **Always On** so the live TV connections aren't dropped.

**Option B: run it from a laptop on the venue Wi-Fi.**

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
3. Open `/wall` and `/counter` full screen (F11) on the TVs.
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
- **The blueprint drawing is code, not image generation.** `wwwroot/js/blueprint.js` draws each part Claude picks.
  That keeps every card on-brand and instant. To add a part, add it to `Catalog.Modules` and `PARTS` in blueprint.js.
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
