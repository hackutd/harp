# Branding

**A shortcut, not a boundary.**

This directory holds the handful of brand values that are wired into more than
one place at once. Setting them here means setting them everywhere, which saves
you grepping for a product name across three TypeScript projects.

That is the entire purpose. It is not a fence around what you are allowed to
restyle, and editing files outside it costs you nothing —
[`ADOPTING.md`](../../../ADOPTING.md) explains why your fork is yours to
redesign completely.

## The three files

| File               | What it controls                                                            |
| ------------------ | --------------------------------------------------------------------------- |
| `index.ts`         | Product name, PWA manifest text, SuperTokens app name, browser theme colour |
| `theme.css`        | The colour palette                                                          |
| `assets/logo.webp` | Sign-in page logo                                                           |

Change all three and you have rebranded the app's identity in about five
minutes. If that is as far as you get this year, it is a reasonable place to
stop.

## What these actually reach

Worth knowing before you plan a redesign around this directory, because two of
the three do less than their names suggest.

**`index.ts` — fully wired.** Everything in it lands where you expect: browser
tab, PWA install prompt, home-screen label, Android status bar, the fallback
title on a push notification, and the sender name on magic-link sign-in emails.

**`assets/logo.webp` — the sign-in page logo.** The browser favicon comes from
the PWA icons in `public/`, so the two can be changed independently.

**`theme.css` — only partly.** It drives the admin and super-admin portal
completely; those pages are built from shadcn components that read the tokens.
The applicant-facing pages are not. They were written with literal Tailwind
colours — `bg-white`, `text-black`, `text-[#8A8A8A]`, `border-[#E5E5E5]` —
roughly 370 of them, and not one reads a token.

What the palette still reaches there are the shadcn primitives that were dropped
in unstyled: checkbox and switch fills, dialog and popover surfaces, alerts,
inputs, skeletons. So the effect is patchy rather than absent, which is the part
worth planning around. Set `--primary` to your school's colour and you get that
colour on checkboxes and toggles, sitting on an otherwise black-and-white page.
If you want the hacker side recoloured, restyle those pages directly.

`--radius` is the exception that works in both places: about forty
`rounded-lg` / `rounded-xl` / `rounded-sm` utilities across the hacker pages
resolve through it. The forty-odd `rounded-full` ones do not.

**The `.dark` block never activates.** Nothing in the app mounts a theme
provider, so the `dark` class is never applied to the document. Keep the block
in sync if you like — it is what a future toggle would read — but editing it
changes nothing you can see today.

**Fonts are not here at all.** There is no `--font-sans` token, no `@font-face`,
and no webfont link anywhere in the portal; everything renders in Tailwind's
default system stack. Add fonts in `src/index.css`, and self-host them rather
than linking a CDN — the service worker already precaches `woff`/`woff2`, so
self-hosted faces survive bad venue wifi.

**Harp's own wordmark is in `src/`.** The letter-by-letter "Hackathon
Application Review Platform" block lives in `src/pages/public/LoginPage.tsx`.
Go delete it. Keep the sign-in logic in that file working — magic-link creation,
the wrong-sign-in-method check, third-party redirects — and change the markup
around it freely.

## Extra assets

The `@/branding` alias resolves this whole directory, not just `logo.webp`, so
you can drop files in and import them with no build changes:

```ts
import hero from "@/branding/assets/hero.webp";
```

Nothing in the applicant experience currently has a slot to put one in — the
only images there are the sign-in logo and the Google icon — so placing it means
editing pages under `src/`. That is expected and fine. Do it.

## Event content does not belong here

The hackathon name, dates, contact address, application questions, FAQ entries,
sponsors, schedule, scan types, and meal groups are all database settings that a
super admin edits from the portal at runtime.

This matters more than it looks. Settings live in Postgres, so they survive you
replacing the entire frontend next year; anything hardcoded into a component
does not. Hardcoding one also means a redeploy every time a date moves. If you
need a new one, add it in `internal/store/settings.go` — and consider sending it
upstream, since every school will want it.

## PWA icons stay in `public/`

`public/pwa-192x192.png` and `public/pwa-512x512.png` are **replace-in-place**:
swap the files, keep the names. They are referenced by absolute URL from the PWA
manifest, browser favicon, and service worker, and the Dockerfile copies the
192px one into the runtime image for Apple Wallet passes. Renaming them breaks
all four.

512×512 and 192×192 PNGs. The 512 also serves as the maskable icon, so keep
roughly 20% padding around the artwork or Android will crop into it.

## How the wiring works

Useful if you move or delete any of this — these are the couplings that make the
directory worth having in the first place.

`index.ts` is imported by three separate TypeScript projects, which is why it
must stay free of DOM types and imports:

- **The app** — `import { branding } from "@/branding"`.
- **The service worker** (`src/sw.ts`) — WebWorker libs rather than DOM.
- **`vite.config.ts`** — builds the PWA manifest, and substitutes
  `%HARP_TITLE%` / `%HARP_THEME_COLOR%` into `index.html`, which cannot import
  TypeScript. That substitution is what keeps the tab title and the installed
  app's identity from drifting apart.

`theme.css` is pulled in by `src/index.css`. Only the raw `:root` / `.dark`
token values live here; the `@theme` mapping that turns them into Tailwind
utilities is in `src/index.css`, along with everything else structural.

After changing anything here, run `npm run format` — CI checks formatting in
this directory too.
