# Adopting Harp

**Harp is a starting point, not a dependency.** Fork it, make it yours, and run
your event. There is no upstream you are expected to track, no merge discipline
to maintain across a year of officer turnover, and no "HackUTD version" that
gets features first.

Most hackathons redesign their site every year. Harp assumes you will too.

## The model

Take a release, deploy it, and treat the code as yours from that moment.
Redesign the frontend as far as you like — rewrite pages, replace the component
library, throw out the layout, change the fonts. None of it is precious, and
none of it is a merge conflict waiting to happen, because you are not merging.

When the next cycle comes around, pick one:

- **Stay put.** Your deployment already works. Not upgrading is a real option
  and costs you nothing.
- **Start fresh from a newer Harp.** Take the new release, design this year's
  look on top of it, and point it at your existing database. You lose last
  year's frontend code — which you were going to redo anyway.
- **Cherry-pick.** Pull a specific upstream fix into your fork by hand, when you
  actually want it.

What you should _not_ do is try to keep a year of your own design changes
merging cleanly against upstream forever.

## The one thing you cannot throw away

> **The code is disposable. The database is not.**

Your Postgres database holds every application, review, score, scan, and setting
your event has ever produced. The code gets replaced; that data has to survive
the replacement. Two consequences follow, and they are the only real discipline
this model asks of you.

**Keep event content in the database, not in code.** The hackathon name, dates,
application questions, FAQ, sponsors, schedule, scan types, meal groups, points
naming, and contact email are already runtime settings that a super admin edits
in the browser. Anything you hardcode into a component dies the moment you start
from a new release. Anything stored as a setting survives for free, and can be
changed mid-event by an organizer with no developer, no deploy, and no downtime.

**Keep your schema close to upstream's.** If you point newer Harp code at your
existing database, the migrations have to line up. Adding a column is cheap;
altering or dropping something upstream owns will hurt later.
[`cmd/migrate/migrations/README.md`](cmd/migrate/migrations/README.md) explains
the numbering rules and why they are load-bearing rather than cosmetic. Read it
before you write a migration.

## Making it yours

### The quick path

`client/portal/branding/` holds the handful of values that are wired into more
than one place at once, so setting them there saves you hunting through the
codebase:

| File               | What it controls                                                            |
| ------------------ | --------------------------------------------------------------------------- |
| `index.ts`         | Product name, PWA manifest text, SuperTokens app name, browser theme colour |
| `theme.css`        | The colour palette                                                          |
| `assets/logo.webp` | Sign-in page logo and browser favicon                                       |

Change those three and the tab title, install prompt, magic-link emails,
favicon, and the whole admin portal follow. It takes about five minutes, and it
is a perfectly reasonable place to stop if you are short on people this year.

The directory is a convenience, not a boundary — read
[`client/portal/branding/README.md`](client/portal/branding/README.md) for what
it reaches and, more usefully, what it does not.

### The real path

Go edit `src/`. All of it, if you want.

The applicant-facing pages under `client/portal/src/pages/hacker/` and
`src/pages/public/` are HackUTD's design, not a neutral baseline: black and
white, heavy type, mobile-first. They were built for one specific event. There
is no reason yours should look like them, and nothing bad happens when you
replace them.

Some honest notes on the terrain before you start:

- **The sign-in page** (`src/pages/public/LoginPage.tsx`) still spells out
  Harp's own wordmark letter by letter. Delete it. The same file also holds real
  sign-in logic underneath the markup — magic-link creation, the
  wrong-sign-in-method check, third-party redirects — so keep that part working.
- **The hacker pages ignore the palette.** They were written with literal
  Tailwind colours (`bg-white`, `text-black`, `text-[#8A8A8A]`) rather than
  theme tokens, so editing `theme.css` will not recolour them. Restyle them
  directly, or convert them to tokens as you go.
- **There is no font hook.** No `--font-sans`, no `@font-face`, no webfont link
  anywhere — everything renders in Tailwind's default system stack. Add fonts in
  `src/index.css`. Self-host them into the app rather than linking a CDN: the
  service worker already precaches `woff`/`woff2`, so self-hosted faces keep
  working on bad venue wifi.
- **Dark mode is not wired up.** `next-themes` is a dependency, but nothing
  mounts a provider, so the `.dark` block never activates.

### What is worth leaving alone

Redesign the frontend freely. Be more deliberate about these, because they are
load-bearing rather than cosmetic:

- **The Go backend and its API shapes**, if you ever want to cherry-pick an
  upstream fix. Divergence here is what makes that painful.
- **`/v1/public/*` response shapes**, which the marketing site consumes.
- **Migration numbering**, for the reasons above.
- **Auth flow logic**, which is easy to break in ways that surface only when a
  real person cannot sign in at 9am on event day.

## Setting up

### 1. Fork

Fork `hackutd/harp` on GitHub, or use it as a template. Start from a release tag
rather than `main` — tags are frozen, `main` moves under you:

```bash
git clone https://github.com/YOUR-SCHOOL/harp.git
cd harp
git tag -l                      # see what has been released
git checkout -b main v0.12.0    # whichever tag is newest
```

Adding an upstream remote is optional now, but useful if you ever want to read
what changed or cherry-pick a fix:

```bash
git remote add upstream https://github.com/hackutd/harp.git
git fetch upstream --tags
```

### 2. Run it locally

Copy the environment templates and start the local stack:

```bash
cp .env.example .env
cp client/portal/.env.example client/portal/.env
docker compose -f docker-compose.local-st.yml up -d
```

That brings up PostgreSQL and a self-hosted SuperTokens, which covers three of
the four required variables. Set `AUTH_BASIC_USER` and `AUTH_BASIC_PASS` to
anything and you can boot. No third-party signups are needed to develop.

```bash
task migrate-up            # apply the schema
air                        # backend on :8080
cd client/portal && npm install && npm run dev   # portal on :3000
```

`.env.example` documents all 38 variables with their defaults and explains which
ones matter in production.

### 3. Design it

See [Making it yours](#making-it-yours). This is the part that takes real time,
and the part that makes it your event rather than a copy of ours.

### 4. Deploy

The `Dockerfile` builds the portal and the Go binary into a single container
that serves everything on port 8080, so anything that runs a container will host
Harp. HackUTD runs it on Google Cloud Run with Neon for PostgreSQL, Google Cloud
Storage for resumes, and SendGrid for email; none of those are required choices.

What you do need: a PostgreSQL database, a SuperTokens instance (managed or
self-hosted), and an email provider — either SendGrid or plain SMTP.

Point `APP_URL` and `FRONTEND_URL` at your real domain before going live.
SuperTokens builds its auth callbacks from them, so sign-in breaks if they are
wrong.

### 5. Configure the event

Sign in as a super admin and work through the onboarding form. It collects the
values the platform cannot guess:

- Hackathon name
- Start and end dates
- Application deadline
- Contact email
- Sender email and sender name for outgoing mail

Once saved, these come from the database rather than your environment, so
renaming the event never needs a redeploy — and they survive you replacing the
entire frontend next year.

Everything below is likewise edited in the portal, not in code:

| What                                                  | Where                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Application questions, sections, and validation       | Super admin → **Application**                                                        |
| FAQ, sponsors, schedule                               | Admin → **FAQ**, **Sponsors**, **Schedule** (super admins control who may edit each) |
| Scan types for check-in, meals, and workshops         | Settings dialog                                                                      |
| Meal groups                                           | Settings → **Meal Groups**                                                           |
| Points naming, and whether points appear at all       | Settings dialog                                                                      |
| Hacker pack URL                                       | Settings → **Hacker Pack**                                                           |
| Reviews required per application, reviewer assignment | Settings dialog                                                                      |
| Whether applications are open                         | Settings dialog                                                                      |
| Clearing last year's data for a new cycle             | Settings → **Reset Hackathon**                                                       |

If you catch yourself hardcoding one of these, stop. It is already a setting,
and the hardcoded version will not survive your next redesign.

## The marketing site

Harp's public site is a **separate repository**:
[hackutd/harp-marketing](https://github.com/hackutd/harp-marketing). It is meant
to be redesigned from scratch for every event, which is exactly why it is not in
here.

It reads schedules, FAQs, and sponsors from `/v1/public/*` using a shared secret
(`PUBLIC_API_KEY` here, `HARP_PUBLIC_API_KEY` there — the two must match), so
organizers update content once and both sites reflect it.

## Starting a new cycle

**Do this between events, never during one.** A hackathon weekend is the worst
possible time to discover a migration surprise.

If you are staying on your current version, there is nothing to do here: clear
last year's data from Settings → **Reset Hackathon** and run it again.

If you are moving to a newer Harp:

1. Read what changed — `git log --oneline v0.12.0..v1.2.0` against upstream.
2. **Check the migrations that landed in between.** This is the part that
   touches your live data, and the only part that can genuinely go wrong.
3. Start from the new release and build this year's design on it, rather than
   merging a year of your changes into it.
4. Point it at your existing database and run `task migrate-up`.
5. Verify sign-in, an application submission, and a scan before you announce it.

Step 2 is the whole risk. The rest is building a website, which you were going
to do anyway.

If you did add your own migrations, read
[`cmd/migrate/migrations/README.md`](cmd/migrate/migrations/README.md) first —
renumbering one that is already applied to a live database needs care, and
picking a very high number to dodge collisions silently breaks every future
upgrade.

## Contributing back

If your school needs something Harp does not do, upstream is a good home for it.
Every school gets the feature, and you stop carrying the patch. Bug reports and
pull requests are welcome at [hackutd/harp](https://github.com/hackutd/harp).

Design work is the exception. Your event's look is yours — keep it.

## It is your copy

Harp is MIT licensed. Do whatever you like with it, including ignoring
everything above. And don't blame me if it all falls apart (there are no HackUTD FDSE
roles)
