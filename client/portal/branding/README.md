# Branding

**This directory is yours. Upstream Harp will not edit it again.**

Nearly everything a school needs to change to make the portal look like its own
event lives here. It sits outside `src/` on purpose: upstream keeps developing
the files in `src/`, so a fork that rebranded by editing them would hit a merge
conflict on every single upgrade. Nothing upstream touches these files, so
`git merge v1.4.0` stays clean no matter how far you have restyled.

"Nearly" is doing real work in that sentence, and the gaps are still being
closed — read [Current limitations](#current-limitations) before you plan a
redesign around this directory.

## What to change

| File               | What it controls                                                            |
| ------------------ | --------------------------------------------------------------------------- |
| `index.ts`         | Product name, PWA manifest text, SuperTokens app name, browser theme colour |
| `theme.css`        | The colour palette — fully on the admin side, partly elsewhere              |
| `assets/logo.webp` | Sign-in page logo and browser favicon                                       |

Start with `appName` in `index.ts` and `assets/logo.webp`; those two carry most
of the portal's identity. Read the limitations below before planning anything
around `theme.css` — it reaches less than its name suggests on the pages
hackers actually use.

## Current limitations

**This is a work in progress.** Making Harp genuinely adoptable is an ongoing
effort and this directory is the newest part of it. What follows is the set of
knobs that exists today, not the set that should exist — expect it to grow, and
expect a future release to pull things you currently have to patch by hand into
here. Until then, know the ceiling before you plan a redesign.

**Names and identity — fully wired.** Everything in `index.ts` lands where you
expect: browser tab, PWA install prompt, home-screen label, Android status bar,
the fallback title on a push notification, and the sender name on magic-link
sign-in emails. `assets/logo.webp` is both the favicon and the login-page logo.
Swapping these genuinely rebrands the app.

**The palette — only partly.** `theme.css` drives the admin and super-admin
portal completely; those pages are built from shadcn components that read the
tokens. The hacker-facing pages are not. They were written with literal Tailwind
colours — `bg-white`, `text-black`, `text-[#8A8A8A]`, `border-[#E5E5E5]` —
roughly 370 of them, and not one reads a token. What the palette still reaches
there are the shadcn primitives dropped in unstyled: checkbox and switch fills,
dialog and popover surfaces, alerts, inputs, skeletons.

So the effect is patchy rather than absent, which is the part worth planning
for. Set `--primary` to your school's colour and you get that colour on
checkboxes and toggles, sitting on an otherwise black-and-white page. Treat a
hacker-side recolour as upstream work, not something this directory can do yet.

`--radius` is the exception that works in both places: about forty
`rounded-lg` / `rounded-xl` / `rounded-sm` utilities across the hacker pages
resolve through it. The forty-odd `rounded-full` ones do not.

**The `.dark` block never activates.** Nothing in the app mounts a theme
provider, so the `dark` class is never applied to the document. Keep the block
in sync anyway — it costs nothing and it is what a future toggle will read —
but editing it changes nothing you can see today.

**Fonts are not brandable.** There is no font hook here at all: no `--font-sans`
token, no `@font-face`, no webfont link anywhere in the portal. Everything
renders in Tailwind's default system stack. Changing that today means editing
`src/index.css`, which upstream owns and will conflict on merge.

**Extra images work; placing them does not.** The `@/branding` alias resolves
this whole directory rather than just `logo.webp`, so
`import hero from "@/branding/assets/hero.webp"` compiles today with no build
changes. But no hacker-facing page has a slot to put one in — the only images in
the entire applicant experience are the login logo and the Google icon.
Placement means editing JSX under `src/`, which is the exact merge conflict this
directory exists to prevent.

**One piece of Harp's own branding is still hardcoded.** The letter-by-letter
"Hackathon Application Review Platform" wordmark on the sign-in page lives in
`src/pages/public/LoginPage.tsx`, not here. See below — this is the one case
where you should go and edit `src/` anyway.

In short: you can change what the portal is called and what it is named after,
and the admin side is the only surface you can restyle coherently. The
applicant-facing design is, for now, largely the one upstream ships.

## The sign-in page: edit it anyway

Everything above is the supported path. The sign-in page is the one place where
it is not yet enough, and where you should patch `src/` regardless.

`src/pages/public/LoginPage.tsx` carries Harp's own wordmark along with the
entire visual treatment of the page. It is the first thing an applicant sees and
the last place you want another organisation's branding, so: open the file,
delete the wordmark, and make the page yours. Import whatever you need from
`assets/` — the `@/branding` alias already resolves this whole directory, so
`import hero from "@/branding/assets/hero.webp"` works with no build changes.

This knowingly breaks the one rule in [`ADOPTING.md`](../../../ADOPTING.md).
That is a gap in Harp rather than something your fork did wrong, and closing it
is on the roadmap. Until then the cost is one file and one predictable conflict
per upgrade, which is worth paying to not ship someone else's logo.

### Remembering the change at merge time

**Keep it in its own commit.** Do not fold the login redesign in with anything
else. One commit touching one file is one you can still find months later, when
the person who wrote it has graduated:

```bash
git log --oneline -- client/portal/src/pages/public/LoginPage.tsx
```

**Read upstream's side before resolving.** This file will conflict when you
merge a new tag. Before keeping your version wholesale, look at what actually
changed:

```bash
git diff v0.9.0..v0.10.0 -- client/portal/src/pages/public/LoginPage.tsx
```

**It is not only markup.** The same file owns real sign-in logic — magic-link
creation, the check that stops someone signing in with the wrong method,
third-party redirects, and error handling. Resolving the conflict by blindly
keeping your side will silently drop upstream fixes to any of those, and you
will not notice until sign-in breaks for someone. Take upstream's logic, keep
your layout.

**One file is an exception; four is a fork.** If you find yourself patching page
after page this way, stop and open an issue upstream instead — that is a
signal the branding surface is missing something every school will want.

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
