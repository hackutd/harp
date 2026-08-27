# Adopting Harp

**Harp is built to be forked.** Your school runs its own copy, with its own
database, its own domain, and its own branding. HackUTD runs it exactly the same
way you will — there is no privileged deployment, and no "HackUTD version" that
gets features first.

This document is the whole adoption path: what you change, what you never
change, and how to pull in upstream releases afterwards.

## The one rule

> **Your fork contains branding and nothing else.**

Everything else — the event name, the application questions, the schedule, who
can review what — is either a runtime setting you edit in the portal, or a
feature that belongs upstream where every school gets it.

This is not tidiness. It is the difference between `git merge v1.4.0` taking a
minute and taking a weekend. Every file you edit outside `client/portal/branding/`
is a file that will conflict on every future upgrade, forever. If you find
yourself wanting to change application logic, that is a gap in Harp — open an
issue or a pull request upstream rather than patching your fork.

### The one exception

The sign-in page is not yet fully brandable, and Harp's own wordmark is
hardcoded into it. Until that is fixed you should edit
`client/portal/src/pages/public/LoginPage.tsx` directly — do not ship an
applicant a login screen with someone else's branding on it.

That is a deliberate exception, not the rule loosening. It is one file, it will
conflict on every upgrade, and the file contains real sign-in logic underneath
the markup, so resolving that conflict carelessly can silently drop an auth fix.
[`client/portal/branding/README.md`](client/portal/branding/README.md) covers
how to make the change survive a merge. Read it before you start.

The wider point stands: the branding directory is still growing, and gaps like
this one are being closed. If you hit another, treat it as a bug in Harp worth
reporting rather than a second file to patch.

### But it is your copy

At the end of the day Harp is MIT licensed — do whatever you'd like with it.

You might be better off maintaining your own copy rather than pulling each year. Both are fine, just choose deliberately. And don't blame me if it all falls apart (we do not have FDSE roles).

## What you change, and where

| Tier              | Where                                          | Examples                                                                                                                     |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Event content** | Super-admin UI, at runtime                     | Hackathon name, dates, application questions, FAQ, sponsors, schedule, scan types, meal groups, points naming, contact email |
| **Brand**         | `client/portal/branding/` in your fork         | Logo, colour palette, product name, PWA manifest — plus the sign-in page, for now                                            |
| **Deployment**    | Environment variables + your own cloud account | Database URL, auth keys, email provider, file storage                                                                        |

There is no fourth tier. Notice how little of it is code: renaming the event or
rewriting the application form is something an organizer does in a browser, with
no developer, no deploy, and no downtime.

## Setting up

### 1. Fork

Fork `hackutd/harp` on GitHub, then point a remote at upstream so you can pull
releases later:

```bash
git clone https://github.com/YOUR-SCHOOL/harp.git
cd harp
git remote add upstream https://github.com/hackutd/harp.git
git fetch upstream --tags
```

Check out the latest release tag rather than tracking `main`. Tags are frozen;
`main` moves under you.

```bash
git tag -l                      # see what has been released
git checkout -b main v0.9.0     # whichever tag is newest
```

### 2. Brand it

Everything you need is in **`client/portal/branding/`**. Read
[`client/portal/branding/README.md`](client/portal/branding/README.md) — it
explains each file and why the directory sits outside `src/`.

The short version: `index.ts` for names and the theme colour, `theme.css` for
the palette, `assets/logo.webp` for the logo. Swap `public/pwa-192x192.png` and
`public/pwa-512x512.png` in place, keeping their filenames.

Upstream will never edit those files again, so that commit costs you nothing at
upgrade time. Its README also documents what the directory does not yet reach —
fonts, the applicant-facing palette, and the sign-in page — so read it before
assuming a restyle is possible without touching `src/`.

Then make your sign-in page edit as a **separate commit**, on its own, touching
only `LoginPage.tsx`. Keeping it apart from the branding commit is what makes it
findable next year.

### 3. Run it locally

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

`.env.example` documents all 38 variables with their defaults and explains
which ones matter in production.

### 4. Deploy

The `Dockerfile` builds the portal and the Go binary into a single container
that serves everything on port 8080, so anything that runs a container will
host Harp. HackUTD runs it on Google Cloud Run with Neon for PostgreSQL, Google
Cloud Storage for resumes, and SendGrid for email; none of those are required
choices.

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

Once that is saved, these come from the database rather than your environment,
so renaming the event never needs a redeploy.

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

If you catch yourself hardcoding one of these, stop — it is already a setting.

## The marketing site

Harp's public site is a **separate repository**:
[hackutd/harp-marketing](https://github.com/hackutd/harp-marketing). It is meant
to be redesigned from scratch for every event, which is exactly why it is not
in here — a yearly redesign should never touch the platform.

It reads schedules, FAQs, and sponsors from `/v1/public/*` using a shared secret
(`PUBLIC_API_KEY` here, `HARP_PUBLIC_API_KEY` there — the two must match), so
organizers update content once and both sites reflect it.

## Upgrading

Harp is released with semantic version tags. Pin to one, and move deliberately:

```bash
git fetch upstream --tags
git log --oneline v0.9.0..v0.10.0      # read what changed
git merge v0.10.0
```

**Upgrade between events, never during one.** A hackathon weekend is the worst
possible time to discover a migration surprise.

If you kept to the one rule, the merge is nearly clean: you own
`client/portal/branding/`, upstream owns everything else, and the two do not
overlap. Expect exactly one conflict — the sign-in page.

### When a merge does conflict

**`LoginPage.tsx`** is the expected one, if you restyled it. Diff upstream's
side before you resolve, rather than keeping yours wholesale:

```bash
git diff v0.9.0..v0.10.0 -- client/portal/src/pages/public/LoginPage.tsx
```

The file holds magic-link creation, the wrong-sign-in-method check, third-party
redirects, and error handling underneath the markup. Take upstream's logic and
keep your layout; discarding its side silently reverts auth fixes, and you find
out when a hacker cannot sign in.

A **migration number collision** — you added `000032`, and so did upstream — is
the other case that needs real care. `cmd/migrate/migrations/README.md` explains
why the numbering is load-bearing and how to renumber safely. Read it before you
touch anything; the obvious workaround of picking a very high number silently
breaks every future upgrade.

Any other conflict outside `branding/` is a signal that something drifted into
your fork that should have gone upstream. Consider sending it there.

## Contributing back

If your school needs something Harp does not do, upstream is the right place for
it. Every school gets the feature, you stop carrying a patch, and your next
upgrade stays clean. Bug reports and pull requests are welcome at
[hackutd/harp](https://github.com/hackutd/harp).
