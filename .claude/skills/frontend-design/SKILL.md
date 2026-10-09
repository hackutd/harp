---
name: frontend-design
description: Visual design system for HARP's hacker-facing UI — the Zero Day "night sky" dark theme. Black canvas, neutral near-black cards, tide (#086C88) as the single action colour, moonlight ice (#D6F9FF) for small highlights, white text and icons, and green/amber/red reserved strictly for statuses. Use this skill when building or redesigning any hacker-side page or component (application flow, dashboard, profile, directory, schedule, status pages) or a full-screen auth/loading/error page, and whenever choosing colours, pills, cards, buttons, or selected states there. Complements the frontend skill (architecture); this skill governs aesthetics.
---

# HARP Hacker-Side Design Guide

Hacker pages live under `src/pages/hacker/` and render inside `HackerLayout`. Each user picks a **dark** (default) or **light** portal theme (`PATCH /v1/users/me/theme`, `useTheme()` / `useApplyPortalTheme()` in `src/shared/hooks/use-theme.ts`); both layouts put `.theme-dark` or `.theme-light` on `<body>` and their wrapper. This guide describes dark; light rebinds the same tokens to the admin palette (white canvas, `#F8F8F7` surfaces, `#171717` ink) and keeps the hacker blue. This skill governs **how they look**; the `frontend` skill governs how they are wired. Both apply together.

## Design language: the night sky

The palette is lifted from the sign-in page's sky art (`src/assets/sky.webp`): a black sky, teal clouds, an ice-white moon. Every hacker screen should feel like that scene — dark, quiet, with colour used sparingly and on purpose.

### Core rules

1. **Four palette colours, nothing else.** Black canvas, white text/icons, tide for actions, ice for small highlights. Surfaces are neutral near-blacks, not new hues.
2. **No purple. No decorative colour.** No violet, pink, indigo, blue, cyan, or Discord-blurple. `#11051F` was tried as a canvas and dropped — it reads purple.
3. **Status colours are reserved.** Green, amber, red appear only for outcomes (accepted / waitlisted / rejected, travel & RSVP outcomes, scan success/failure, destructive actions, live "now" lines). Pre-decision and informational states stay in the palette.
4. **No gradients, glows, or shadows.** Flat fills and 1px borders separate things. (Masks used for scroll fades and the schedule's hour-line `repeating-linear-gradient` are drawing techniques, not visual gradients — they are fine.)
5. **Quiet selected states.** Selected tabs, nav items, and toggle chips get a faint ice wash and ice text — never a solid tide fill.
6. **Icons are white** (`text-ink`, or `text-ink/65` when muted). Never tint icons ice.
7. **Mobile-first.** Design at 390px; every tap target ≥ 44×44px.

---

## Palette & tokens

Defined in `src/index.css` (`:root` raw values + `@theme inline` utilities):

| Token / utility   | Value                           | Use                                                         |
| ----------------- | ------------------------------- | ----------------------------------------------------------- |
| `canvas`          | `#000000`                       | Page background (`bg-canvas`)                               |
| `surface`         | `#0c0c0d`                       | Cards, panels, popovers (`bg-surface`)                      |
| `surface-2`       | `#171719`                       | Hover fills, raised controls (`bg-surface-2`)               |
| `ink`             | `#FFFFFF`                       | Text and icons (`text-ink`, `text-ink/65`, `border-ink/10`) |
| `tide`            | `#086C88`                       | The one action colour: primary buttons, progress, dots      |
| `tide-hover`      | tide 82% + ice                  | Hover/active of tide fills                                  |
| `ice`             | `#D6F9FF`                       | Small highlights: eyebrow labels, info pills, selected text |
| status (Tailwind) | `emerald-*`, `amber-*`, `red-*` | Outcomes only — see Pills                                   |

`canvas`, `surface`, `surface-2`, and `ink` are **semantic**: the light theme is a token swap in `index.css` (`.theme-light`), so always use these utilities rather than `bg-black`, `text-white`, or hex literals in hacker pages, or the page breaks in one of the two themes. For the rare colour no token carries, use the `theme-dark:` variant.

**Text opacity ladder** (on canvas/surface): `text-ink` primary · `text-ink/85` strong secondary · `text-ink/65` muted body/helper · `text-ink/55` labels · `text-ink/40` placeholders/disabled.

**Borders:** `border-ink/10` default, `border-ink/15` inputs/controls, `border-ice/30` only on info pills and selected chips.

**Contrast:** tide on black is ~3.5:1 — fine for fills, borders, and large marks, **not** for small text. Accent text is ice; text on a tide fill is white.

---

## Pills (status & tone)

Use `pillClass(tone)` from `src/pages/hacker/components/tones.ts`; application statuses map through `STATUS_PILL_CLASSES` in `applicationStatus.ts`.

| Tone      | Classes                                                    | Use                                     |
| --------- | ---------------------------------------------------------- | --------------------------------------- |
| `neutral` | `border-ink/15 bg-ink/5 text-ink/75`                       | Draft, declined, "travel under review"  |
| `info`    | `border-ice/30 bg-ice/15 text-ice`                         | Under review, informational             |
| `success` | `border-emerald-400/30 bg-emerald-400/10 text-emerald-400` | Accepted, spot claimed, travel approved |
| `warning` | `border-amber-400/40 bg-amber-400/10 text-amber-300`       | Waitlisted                              |
| `danger`  | `border-red-400/30 bg-red-400/10 text-red-400`             | Not accepted, travel not approved       |

Pills are tinted outlines, never solid status fills with white text.

---

## Component patterns

### Cards

Flat, neutral, bordered. No gradient, glow, or shadow — including the application status card.

```tsx
<div className="rounded-xl border border-ink/10 bg-surface p-5">
  <span className={pillClass("success")}>Accepted</span>
  <h2 className="mt-3 text-xl font-light tracking-tight">Application status</h2>
  <p className="mt-2 text-sm font-light text-ink/65">…</p>
</div>;

// Tappable card: same shell + hover
className = "… transition-colors hover:border-ice/30 hover:bg-surface-2";
```

### Buttons

```tsx
// Primary — solid tide, white text
<Button className="h-12 w-full rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover">
  RSVP to claim your spot
</Button>

// Secondary — outline
<Button variant="outline" className="h-12 w-full rounded-full border-ink/15 bg-transparent text-ink hover:bg-surface-2">
  Save draft
</Button>

// Text link / icon button — muted, white on hover (never ice on hover)
<button className="text-sm font-light text-ink/65 hover:text-ink">See all</button>
```

### Selected states (tabs, nav, chips, toggles)

```tsx
selected
  ? "border-ice/30 bg-ice/10 text-ice"
  : "border-ink/10 text-ink/65 hover:text-ink";
```

The mobile tab bar (`.zero-tabbar*` in `index.css`) and the sidebar active item follow the same rule: a ~9% ice wash with ice text/icon. The sidebar's collapse-rail hover line is `rgb(255 255 255 / 14%)` — a hint, not a highlight.

### Desktop sidebar (`src/layouts/PortalSidebar.tsx`)

One component serves both portals: `HackerLayout` passes `portal="hacker"` and one unlabelled section; `AdminLayout` passes `portal="admin"` and labelled sections (Applicants, Event, Super Admin), plus a Hackathon Settings entry in the account menu for super admins that opens the settings dialog. The tone follows the user's theme, not the portal: `.hacker-zero-sidebar` in dark, `.admin-sidebar` (a light `#F8F8F7` panel that rebinds the ink/surface tokens) in light, so the markup is shared.


- **Header:** a "Zero Day ⌄" switcher (dropdown: _Hacker portal ✓_ / _Zero Day — Go back to zeroday.hackutd.co_) and a close-sidebar button (`PanelLeftClose`). Collapsed, the header is just an open-sidebar button (`PanelLeftOpen`). The toggle's tooltip shows the shortcut (`⌘B` on Apple platforms, `Ctrl+B` elsewhere).
- **Nav:** `collapsible="icon"` — collapsed, the icons stay visible and clickable, each with a right-side tooltip. Labels are light (300); the active item is 400 on the quiet ice wash.
- **Footer:** an account menu — avatar, the hacker's name (from their application; falls back to their role, e.g. "Hacker") and email. It opens onto Settings (the account Settings dialog, `src/pages/hacker/settings/`, also opened by the gear on the Profile page), a Light mode / Dark mode switch, Admin view (admins only), Back to Zero Day, and Log out.
- Tooltips in the hacker theme are dark (`surface-2`, hairline border), not shadcn's inverted white chip.

### Icons

```tsx
<Icon className="size-5 text-ink" strokeWidth={1.5} />          // default
<ChevronRight className="size-5 text-ink/65" />                // muted affordance
// Icon in a round badge: neutral wash, white glyph
<span className="flex size-10 items-center justify-center rounded-full bg-ink/10 text-ink">…</span>
```

### Inputs

Inputs inherit the theme (`--input`, caret ice, placeholder white/32%). Underline-style fields use `border-b border-ink/15 focus:border-ice/50`.

### Schedule categories

Event tags (`src/shared/lib/schedule-colors.ts`) step through the palette by lightness instead of adding hues: Required = status red, Company events = tide, Food = tide/ice mix, Workshops = ice, For fun = `#a3a3a3`, Other = `#5c5c5c`. Each tag carries an `ink` colour for legible text on its solid (selected) fill.

### Confetti

`CelebrationEffect` uses tide, ice, white, and the success green (`--portal-green`) — mirror the hex values if you add a burst.

---

## Full-screen auth, loading & error pages

Sign-in, magic-link verify, OAuth callback, the auth-method-mismatch error, `ErrorPage`, `AuthFlowSkeleton`, and `HackerPageLoader fullscreen` all sit on the **same night sky** as the login page:

```tsx
<main className="zero-login relative isolate min-h-svh overflow-hidden bg-black text-white">
  <SkyBackdrop />{" "}
  {/* src/components/SkyBackdrop.tsx: sky art + shooting stars */}…
  <section className="zero-login-panel relative p-px">
    {" "}
    {/* clipped panel, hairline ice rim */}
    <div className="zero-login-panel-inner px-5 py-6 sm:px-8 sm:py-8">…</div>
  </section>
</main>
```

- Primary actions: `zero-cut-button bg-tide text-white hover:bg-tide-hover`; secondary: `border-ice/50 bg-transparent hover:bg-ice/10`.
- HUD eyebrow labels are `font-mono text-[10px] tracking-[0.28em] text-ice uppercase`.
- **No mascots.** The animated mascot layer was removed; do not reintroduce decorative characters.
- Full-page loaders show the title art and a scan line only — no "Loading // …" text.

In-layout loaders (`HackerPageLoader` without `fullscreen`, `HackerSkeleton`) are dashboard-shaped placeholders on the canvas; `.zero-skeleton` gives blocks a faint breathing white fill.

---

## Typography

Fonts are self-hosted in `src/index.css`: **Satoshi** (`font-satoshi`, text) and **Hypik** (`font-hypik`, display — letters and spaces only, no digits or punctuation). Hacker page headings are light and tight (`text-xl font-light tracking-tight`); small labels are uppercase with wide tracking. Keep to ~3 type sizes per screen.

---

## Motion

- 200–350ms for UI state, 300–500ms for reveals; `ease-out` in, `ease-in-out` for state changes.
- `active:scale-[0.98]` on tappable cards and buttons.
- No bouncy springs. Respect `prefers-reduced-motion` (existing keyframes already do).

---

## What to avoid

- Hex literals or raw Tailwind hues (`bg-[#…]`, `text-blue-600`, `bg-violet-*`) in hacker pages — use the tokens.
- Purple anything; teal-tinted card surfaces (cards are neutral near-black).
- Gradients, radial glows, coloured box-shadows, text-shadows.
- Solid tide fills for _selected_ states; ice-tinted icons; ice on hover.
- Status colours for non-status meaning (e.g. amber for "just networking").
- Solid status pills with white text.
- Mascots or other decorative animated characters.
