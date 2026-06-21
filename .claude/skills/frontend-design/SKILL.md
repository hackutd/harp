---
name: frontend-design
description: Create distinctive, production-grade hacker-facing UI for HARP following the Nike mobile app design language — bold black/white contrast, heavy athletic typography, and clean mobile-first layouts. Use this skill when building or redesigning any hacker-side page or component (application flow, dashboard, profile, status pages) and when visual/aesthetic quality matters. Complements the frontend skill (which handles architecture), this skill handles aesthetics.
---

# HARP Hacker-Side Design Guide

All hacker-facing pages live under `src/pages/hacker/`. This skill governs **how they look and feel** — the frontend skill governs how they're wired up. Both skills apply together when building hacker pages.

## Design Language: Nike Athletic Minimal

The hacker-side of HARP follows the Nike mobile app's design language: stark black-and-white contrast, bold geometric typography, generous white space, and purposeful motion. Every screen should feel premium, intentional, and athletic — like putting on a product that performs.

### Core Principles

1. **Black and white as the primary palette** — color is for status only (success green, error red, warning orange). Never use decorative color.
2. **Typography carries weight** — headlines are bold and large; body is readable and restrained. Size contrast does the visual lifting.
3. **Generous spacing** — breathe. Nike screens use padding aggressively; content never fights the edges.
4. **Full-width, edge-to-edge sections** — cards and content blocks fill the container; avoid floating island layouts.
5. **Mobile-first always** — design at 390px first, then scale up. Every interactive element is thumb-reachable.

---

## Typography

Use **[Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue)** (display/hero headings) paired with **[Inter](https://fonts.google.com/specimen/Inter)** (body and UI text). This mirrors Nike's pairing of a bold condensed display face with a clean, functional sans-serif.

```css
/* In your Tailwind v4 CSS */
@import url("https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap");

@theme {
  --font-display: "Bebas Neue", sans-serif;
  --font-body: "Inter", sans-serif;
}
```

| Role              | Font       | Weight | Size (mobile) | Tracking | Example use                     |
| ----------------- | ---------- | ------ | ------------- | -------- | ------------------------------- |
| Hero / Page title | Bebas Neue | 400    | 48–64px       | -0.03em  | "YOUR APPLICATION", "WELCOME"   |
| Section heading   | Inter      | 700    | 20–24px       | -0.02em  | "Personal Info", "Team Details" |
| Card label        | Inter      | 600    | 13–14px       | 0.08em   | Field labels, status badges     |
| Body              | Inter      | 400    | 15–16px       | 0        | Paragraph text, descriptions    |
| Caption / helper  | Inter      | 400    | 12px          | 0        | Help text, timestamps           |
| CTA button        | Inter      | 700    | 14–15px       | 0.05em   | "SUBMIT APPLICATION", "SAVE"    |

**Rules:**

- All-caps for Bebas Neue hero text always
- All-caps + wide tracking for button labels and small UI labels (Nike pattern)
- No more than 3 type sizes on a single screen

---

## Color Palette

```css
@theme {
  /* Core — always available */
  --color-ink: #000000; /* primary text, filled buttons */
  --color-paper: #ffffff; /* page background, inverse text */
  --color-ink-muted: #6b6b6b; /* secondary text, placeholders */
  --color-surface: #f5f5f5; /* card backgrounds, input fills */
  --color-border: #e5e5e5; /* dividers, input borders */
  --color-border-strong: #111111; /* focused inputs, active states */

  /* Status — use only for meaning, never decoration */
  --color-success: #1a8a1a;
  --color-error: #d32f2f;
  --color-warning: #e65100;
  --color-info: #1565c0;
}
```

**Application status colors** (map to hacker application states):

- `draft` → `--color-ink-muted` (gray)
- `submitted` → `--color-info` (blue)
- `under_review` → `--color-warning` (orange)
- `accepted` → `--color-success` (green)
- `rejected` / `waitlisted` → `--color-error` / `--color-ink-muted`

---

## Component Patterns

### Page Layout

Every hacker page follows a consistent scaffold:

```tsx
// Standard hacker page scaffold
export default function HackerPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Full-bleed hero bar */}
      <div className="bg-black px-6 pt-safe pb-8">
        <p className="text-xs font-semibold tracking-widest text-white/50 uppercase mb-1">
          HackUTD
        </p>
        <h1 className="font-display text-5xl text-white uppercase leading-none tracking-tight">
          Page Title
        </h1>
      </div>

      {/* Content — 24px horizontal padding, 32px section gap */}
      <div className="px-6 py-8 space-y-8">{/* sections */}</div>
    </div>
  );
}
```

### Buttons

Two variants only — solid (primary actions) and outline (secondary). Both full-width on mobile.

```tsx
// Primary CTA — solid black
<button className="w-full bg-black text-white text-sm font-bold tracking-widest uppercase px-6 py-4 active:scale-[0.98] transition-transform">
  Submit Application
</button>

// Secondary — outline
<button className="w-full border-2 border-black text-black text-sm font-bold tracking-widest uppercase px-6 py-4 active:scale-[0.98] transition-transform">
  Save Draft
</button>

// Disabled state — always same structure, muted
<button disabled className="w-full bg-[#E5E5E5] text-[#9E9E9E] text-sm font-bold tracking-widest uppercase px-6 py-4 cursor-not-allowed">
  Not Available
</button>
```

No rounded corners on primary buttons (Nike uses 0px or 2px radius max). Use `rounded-sm` at most.

### Form Inputs

Clean, borderless-bottom Nike-style inputs:

```tsx
// Field group pattern
<div className="space-y-1">
  <label className="text-xs font-semibold tracking-widest uppercase text-[#6B6B6B]">
    First Name
  </label>
  <input
    className="w-full border-0 border-b-2 border-[#E5E5E5] bg-transparent text-base text-black py-3 focus:border-black focus:outline-none transition-colors placeholder:text-[#BDBDBD]"
    placeholder="Enter your name"
  />
</div>
```

For multi-line / complex form sections, use a card-style container:

```tsx
<div className="bg-[#F5F5F5] p-5 space-y-5">{/* fields */}</div>
```

### Cards

Flat, no shadow, edge-to-edge or full-width within container:

```tsx
// Info card — used for application status, summaries
<div className="border border-[#E5E5E5] p-5">
  <p className="text-xs font-semibold tracking-widest uppercase text-[#6B6B6B] mb-2">
    Application Status
  </p>
  <p className="text-2xl font-bold text-black">Under Review</p>
</div>

// Dark card — used for highlighted information
<div className="bg-black text-white p-5">
  <p className="text-xs font-semibold tracking-widest uppercase text-white/50 mb-2">
    Decision
  </p>
  <p className="text-2xl font-bold">Accepted</p>
</div>
```

### Progress / Steps

Multi-step application progress (Nike progress bar pattern):

```tsx
// Step indicator — horizontal dash progress
<div className="flex gap-1 mb-6">
  {steps.map((_, i) => (
    <div
      key={i}
      className={cn(
        "h-1 flex-1 transition-colors",
        i < currentStep
          ? "bg-black"
          : i === currentStep
            ? "bg-black"
            : "bg-[#E5E5E5]",
      )}
    />
  ))}
</div>
```

### Status Badges

```tsx
// Inline badge — all-caps, no border-radius
<span className="text-xs font-bold tracking-widest uppercase px-2 py-1 bg-black text-white">
  Submitted
</span>

// Or outline variant
<span className="text-xs font-bold tracking-widest uppercase px-2 py-1 border border-black text-black">
  Draft
</span>
```

### Navigation / Tab Bar

Bottom tab bar (mobile), top nav bar (desktop):

````

---

## Motion

Use CSS transitions and `transition-*` Tailwind classes. For page-level reveals, use Tailwind's `animate-` utilities or minimal CSS keyframes. No complex animation libraries needed — restraint is the Nike way.

```css
/* Staggered reveal for list items — add to global CSS */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-up {
  animation: fade-up 0.3s ease forwards;
}
````

```tsx
// Apply stagger via inline style
{
  items.map((item, i) => (
    <div
      key={item.id}
      className="animate-fade-up opacity-0"
      style={{ animationDelay: `${i * 60}ms` }}
    >
      {/* content */}
    </div>
  ));
}
```

**Rules:**

- Duration: 200–350ms for UI interactions, 300–500ms for page reveals
- Easing: `ease-out` for reveals, `ease-in-out` for state changes
- `active:scale-[0.98]` on all tappable elements (Nike's press feedback)
- No bouncy/springy animations — everything is precise and athletic

---

## Layout & Spacing

| Token   | Value   | Use                              |
| ------- | ------- | -------------------------------- |
| page-x  | 24px    | Horizontal page padding          |
| section | 32px    | Vertical gap between sections    |
| card    | 20px    | Internal card padding            |
| stack   | 12–16px | Vertical gap within a section    |
| tight   | 4–8px   | Label-to-input, icon-to-text gap |

Use `safe-area-inset` padding for iOS: `pt-safe`, `pb-safe` (configure in Tailwind v4 or use `env(safe-area-inset-*)` directly).

---

## What to Avoid

- No rounded-full pills on buttons (use `rounded-sm` at most)
- No box shadows (flat design only; borders for separation)
- No gradients or decorative color
- No hero images that are purely decorative — if an image exists, it's content
- No border-radius on cards (Nike cards are sharp-cornered)
- No competing font families — Bebas Neue + Inter only
- No purple, teal, or gradient color schemes
- No dense information layouts — if it feels cluttered, add space
- No small touch targets — minimum 44×44px for all interactive elements
