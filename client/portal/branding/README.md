# Branding

**This directory is yours. Upstream Harp will not edit it again.**

Everything a school needs to change to make the portal look like its own event
lives here. It sits outside `src/` on purpose: upstream keeps developing the
files in `src/`, so a fork that rebranded by editing them would hit a merge
conflict on every single upgrade. Nothing upstream touches these files, so
`git merge v1.4.0` stays clean no matter how far you have restyled.

## What to change

| File               | What it controls                                                            |
| ------------------ | --------------------------------------------------------------------------- |
| `index.ts`         | Product name, PWA manifest text, SuperTokens app name, browser theme colour |
| `theme.css`        | The full colour palette, light and dark                                     |
| `assets/logo.webp` | Sign-in page logo and browser favicon                                       |

Start with `--primary` and `--primary-foreground` in `theme.css` and `appName`
in `index.ts`. That covers most of what a hacker actually sees.

## What does NOT belong here

Event-level content is **not** branding. The hackathon name, dates, contact
address, application questions, FAQ entries, sponsors, schedule, scan types,
and meal groups are all database settings that a super admin edits from the
portal at runtime.

Putting any of those here would mean a redeploy every time the event is renamed
or a date moves. If you find yourself wanting to hardcode one, add it as a
setting in `internal/store/settings.go` instead — and consider sending that
upstream, since every school will want it.

## PWA icons stay in `public/`

`public/pwa-192x192.png` and `public/pwa-512x512.png` are **replace-in-place**:
swap the files, keep the names. They are referenced by absolute URL from the
PWA manifest and the service worker, and the Dockerfile copies the 192px one
into the runtime image for Apple Wallet passes. Renaming them breaks all three.

512×512 and 192×192 PNGs. The 512 also serves as the maskable icon, so keep
roughly 20% padding around the artwork or Android will crop into it.

## How the wiring works

`index.ts` is imported three ways, which is why it must stay free of DOM types
and imports:

- **The app** — `import { branding } from "@/branding"`.
- **The service worker** (`src/sw.ts`) — a separate TypeScript project with
  WebWorker libs rather than DOM.
- **`vite.config.ts`** — builds the PWA manifest, and substitutes
  `%HARP_TITLE%` / `%HARP_THEME_COLOR%` into `index.html`, which cannot import
  TypeScript. That substitution is what keeps the tab title and the installed
  app's identity from drifting apart.

`theme.css` is pulled in by `src/index.css`. Only the raw `:root` / `.dark`
token values live here; the `@theme` mapping that turns them into Tailwind
utilities stays in `src/index.css`, because that part is structural and
upstream maintains it.

After changing anything here, run `npm run format` — CI checks formatting in
this directory too.
