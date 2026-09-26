# create-harp

Stands up a production HARP deployment on Google Cloud from your fork. It
automates the `gcloud` side of the setup and asks you for the handful of values
it cannot create itself.

```bash
cd your-harp-fork
npx @hackutd/create-harp            # or, before it is published:
node tools/create-harp/bin/create-harp.js
```

Start with `--dry-run`. It only reads from Google Cloud and prints every
command it would run:

```bash
node tools/create-harp/bin/create-harp.js --dry-run
```

## What it does

In order, and each step checks what already exists first, so re-running is
safe:

| Step              | Result                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Project           | Creates the project, or uses an existing one                                                            |
| Billing           | Links the billing account you pick                                                                      |
| APIs              | Enables Cloud Run, Cloud Build, Artifact Registry, Secret Manager, IAM, IAM Credentials, Cloud Storage and a few others |
| IAM               | Grants the default compute service account what it needs to run the app, sign resume URLs, and build and deploy |
| Cloud Storage     | Creates a private resume bucket with CORS set to your service URL and `localhost:3000`                   |
| Secret Manager    | Stores `SENDGRID_API_KEY` and grants the runtime access to it                                           |
| Artifact Registry | Creates the Docker repository, with a cleanup policy (keep the newest 5 images)                          |
| Cloud Run         | Creates service `harp` with all 22+ environment variables                                               |
| Migrations        | Applies `cmd/migrate/migrations` to your database                                                       |
| Cloud Build       | Adds a trigger that builds and deploys on every push to your branch, then runs it once                  |
| Super admin       | Optional: once you have signed in, promotes your account                                                |

It also generates the values nobody should pick by hand: the VAPID key pair,
`AUTH_BASIC_PASS`, and `PUBLIC_API_KEY`. On a re-run it reuses whatever is
already deployed, so nothing gets rotated. That matters most for VAPID: a new
key pair would break every existing browser push subscription.

## What you need first

- **`gcloud`**, logged in (`gcloud auth login`), plus **Node.js 20+**.
- **A fork of HARP on GitHub**, cloned locally. Run the tool from the clone's
  root. Cloud Build deploys from the fork, so you need to be able to install a
  GitHub App on it (you own it, or you are an admin of its org).
- **PostgreSQL.** On [Neon](https://neon.tech), create a project (Postgres 16),
  click _Connect_, and copy the pooled connection string.
- **SuperTokens.** On [supertokens.com](https://supertokens.com), open
  _Managed Service_, create a core, and copy the connection URI and API key.
- **Email.** Either a SendGrid API key or SMTP credentials. The sender address
  must be verified with your provider, or no mail goes out.
- For migrations, one of: [golang-migrate](https://github.com/golang-migrate/migrate)
  (`brew install golang-migrate`) or a running Docker daemon.

## The manual steps

Three steps need a browser, because Google and GitHub only offer them behind a
consent screen. When the tool reaches each one, it prints the exact links and
values, offers to open the page, and waits:

1. **Google sign-in.** Create the OAuth consent screen and a Web client. The
   tool prints the JavaScript origins and redirect URIs to paste in, then asks
   for the client ID and secret. While the consent screen is in _Testing_, only
   the test users you list can sign in with Google. Add your organizers, or
   publish the app before applications open. Skip this entirely and HARP runs
   passwordless-only.
2. **Connect GitHub to Cloud Build.** Open the link the tool prints, choose
   _GitHub (Cloud Build GitHub App)_, sign in, and install the app on your
   fork (that repository only is enough). Select the repository, tick the
   consent box, click _Connect_, then _Done_. Do not create a trigger there;
   the tool creates it. It keeps retrying until Cloud Build can see the repo.
   If the app is already installed on your account from an earlier project,
   you only need to select the repository.
3. **Sync your fork, if needed.** Before the first build, the tool checks
   GitHub's public API. If your branch is behind the repository it was forked
   from, it links you to _Sync fork → Update branch_, since the first build
   deploys whatever is on that branch.

With `--yes` the tool cannot wait, so it exits at step 2 with the
instructions. Do the step, then run the same command again; everything already
created is skipped.

## Options

```
--dry-run            Only read from Google Cloud; print every change instead of making it
--account <email>    Refuse to run unless gcloud's active account is exactly this one
--config <file>      Answers file (default: ./harp.deploy.json)
--dir <path>         Path to the HARP repository (default: current directory)
-y, --yes            Non-interactive: answers from --config, secrets from HARP_* variables
--skip-migrations    Do not apply database migrations
--skip-build         Do not start the first Cloud Build run
```

Every `gcloud` call is pinned to the verified account with `--account`. The
tool never changes your default gcloud project or configuration.

### Re-running and non-interactive use

After the plan is confirmed, the non-secret answers are saved to
`harp.deploy.json`. That file is gitignored because it names your billing
account. The next run starts from those answers.

Secrets are never written to disk or printed. The one exception is a mode-0600
env file in a private temp directory, which exists only while `gcloud run
deploy` reads it. For `--yes`, pass secrets in as environment variables:

```
HARP_DB_ADDR  HARP_SUPERTOKENS_API_KEY  HARP_SENDGRID_API_KEY  HARP_EMAIL_PASSWORD
HARP_GOOGLE_CLIENT_SECRET  HARP_AUTH_BASIC_PASS  HARP_PUBLIC_API_KEY  HARP_VAPID_PRIVATE_KEY
```

## Cost

Nothing it creates has a standing charge:

- Cloud Run bills per request and scales to zero.
- Builds, secrets, logs and a few images normally fit within Google Cloud's
  monthly free allowances.
- The Artifact Registry cleanup policy keeps image storage from creeping
  upward.
- Resumes in the `US` multi-region bucket cost about $0.026 per GB-month.

Billing must still be linked, because Cloud Run, Cloud Build and Artifact
Registry refuse to run without it. To tear it all down, delete the project:
`gcloud projects delete <project-id>`.

## Where it differs from the hand-built reference project

It follows the audited `harp-test` project, with these deliberate changes:

- **APIs.** It enables only the APIs HARP calls. Their dependencies (BigQuery,
  Pub/Sub, Dataplex, …) are switched on by Google as before.
- **Bucket.** Public access prevention is **enforced**, not inherited; signed
  URLs still work. The Cloud Build `storage.admin` grant on the bucket is
  dropped, since the app never uses it. The CORS origin comes from the service
  URL, so a typo like `https://https://…` can't happen.
- **Service agents.** Their project bindings are not re-added, because Google
  manages them.
- **Build flags.** `VITE_GOOGLE_AUTH_ENABLED` is passed as a Docker build
  argument. As a runtime env var it had no effect on the compiled portal.
  `VITE_CONTACT_EMAIL` is dropped because the Dockerfile does not read it.
- **Migrations.** They run against Neon's direct endpoint (the host without
  `-pooler`); golang-migrate's advisory lock expects a session-mode connection.
  The app itself keeps the pooled URI.
- **Trigger name.** It is `<service>-deploy-<branch>` instead of a
  console-generated name. Its substitutions are updated with
  `gcloud builds triggers import`, because `triggers update github` rejects
  triggers that have an inline build config.

## Development

```bash
cd tools/create-harp
npm test
```

The test suite runs the full provisioning flow against a stateful fake
`gcloud` (`test/fake-gcloud.mjs`), including a re-run and the IAM-propagation
retry. It never contacts Google Cloud. The package has no dependencies.
