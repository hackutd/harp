// Provisioning steps. Each one checks what exists before changing anything, so
// the whole run is safe to repeat: a second run only fills in what is missing.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { offerToOpen } from "./github.js";
import { c, HarpError, ui } from "./ui.js";

// Only the APIs HARP uses directly. Their dependencies (Pub/Sub, BigQuery,
// Monitoring, …) are switched on by Google automatically.
export const REQUIRED_SERVICES = [
  "cloudapis.googleapis.com",
  "run.googleapis.com",
  "cloudbuild.googleapis.com",
  "artifactregistry.googleapis.com",
  "containeranalysis.googleapis.com",
  "secretmanager.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "storage.googleapis.com",
  "logging.googleapis.com",
];

// Roles for the default compute service account, which is both the Cloud Run
// runtime identity and the Cloud Build trigger's identity.
//   editor              — GCS object access and general runtime access
//   tokenCreator        — sign GCS upload URLs through IAM (no key files)
//   serviceAccountUser  — Cloud Build may deploy a service that runs as it
//   run.admin           — Cloud Build deploy step
//   artifactregistry.*  — Cloud Build push step
//   logging.logWriter   — build logs (CLOUD_LOGGING_ONLY)
const COMPUTE_SA_ROLES = [
  "roles/editor",
  "roles/artifactregistry.writer",
  "roles/iam.serviceAccountTokenCreator",
  "roles/iam.serviceAccountUser",
  "roles/logging.logWriter",
  "roles/run.admin",
];

const PLACEHOLDER_IMAGE = "us-docker.pkg.dev/cloudrun/container/placeholder";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A just-enabled API can answer PERMISSION_DENIED even to the project owner
// for a minute or two while its IAM catches up.
const FRESH_API = /PERMISSION_DENIED|has not been used|is disabled|SERVICE_DISABLED/i;
// Overridable so the test suite does not wait on real-world timings.
const POLL_MS = Number(process.env.CREATE_HARP_POLL_MS) || 15000;

// Scratch files (env vars with secrets, CORS JSON, build config) live in a
// private temp dir that is removed on exit, even on failure.
export class Scratch {
  constructor() {
    this.dir = mkdtempSync(path.join(tmpdir(), "create-harp-"));
  }
  write(name, content) {
    const file = path.join(this.dir, name);
    writeFileSync(file, content, { mode: 0o600 });
    return file;
  }
  remove(file) {
    rmSync(file, { force: true });
  }
  cleanup() {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

export function derive(ctx, cfg) {
  const number = ctx.state.projectNumber ?? "<project-number>";
  const d = {
    projectNumber: number,
    computeSa: `${number}-compute@developer.gserviceaccount.com`,
    legacyCloudBuildSa: `${number}@cloudbuild.gserviceaccount.com`,
    appUrl: `https://${cfg.serviceName}-${number}.${cfg.region}.run.app`,
    arHost: `${cfg.region}-docker.pkg.dev`,
  };
  d.imageBase = `${d.arHost}/${cfg.projectId}/${cfg.arRepository}/${cfg.githubRepo}/${cfg.serviceName}`;
  return d;
}

// ── Project, billing, APIs ───────────────────────────────────────────────────

export async function ensureProject(ctx, cfg) {
  ui.step("Project");
  const { gcloud } = ctx;
  if (ctx.state.projectExists) {
    ui.skip(`Project ${cfg.projectId} already exists.`);
    return;
  }
  await gcloud.run(["projects", "create", cfg.projectId, `--name=${cfg.projectName}`], { mutating: true });
  if (gcloud.dryRun) return;
  for (let i = 0; i < 30; i++) {
    const p = await gcloud.json(["projects", "describe", cfg.projectId]);
    if (p?.lifecycleState === "ACTIVE") {
      ctx.state.projectNumber = p.projectNumber;
      ctx.state.projectExists = true;
      ui.ok(`Created project ${cfg.projectId} (${p.projectNumber}).`);
      return;
    }
    await sleep(2000);
  }
  throw new HarpError(`Project ${cfg.projectId} was created but never became ACTIVE.`);
}

export async function ensureBilling(ctx, cfg) {
  ui.step("Billing");
  const { gcloud } = ctx;
  const info = ctx.state.projectExists ? await gcloud.json(["billing", "projects", "describe", cfg.projectId]) : null;
  if (info?.billingEnabled) {
    ui.skip(`Billing already enabled (${info.billingAccountName.replace("billingAccounts/", "")}).`);
    return;
  }
  const result = await gcloud.run(
    ["billing", "projects", "link", cfg.projectId, `--billing-account=${cfg.billingAccount}`],
    { mutating: true, allowFailure: true },
  );
  if (result.code !== 0) {
    const quota = /quota|cloudbilling.googleapis.com\/project_quota|precondition/i.test(result.stderr);
    throw new HarpError(
      `Could not link billing account ${cfg.billingAccount}:\n    ${result.stderr.trim().split("\n").slice(-3).join("\n    ")}`,
      quota
        ? "This billing account has hit its linked-project limit. Unlink an unused project or request a quota increase, then re-run."
        : undefined,
    );
  }
  if (!gcloud.dryRun) ui.ok(`Linked billing account ${cfg.billingAccount}.`);
}

export async function ensureServices(ctx, cfg) {
  ui.step("APIs");
  const { gcloud } = ctx;
  const enabledRaw = ctx.state.projectExists
    ? await gcloud.value(["services", "list", "--enabled", `--project=${cfg.projectId}`], "config.name")
    : "";
  const enabled = new Set((enabledRaw ?? "").split("\n").filter(Boolean));
  const missing = REQUIRED_SERVICES.filter((s) => !enabled.has(s));
  if (missing.length === 0) {
    ui.skip("All required APIs are already enabled.");
    return;
  }
  ui.info(`Enabling ${missing.length} API(s); this can take a minute or two…`);
  await gcloud.run(["services", "enable", ...missing, `--project=${cfg.projectId}`], {
    mutating: true,
    retryOn: /billing/i,
  });
  if (!gcloud.dryRun) ui.ok("APIs enabled.");
}

export async function waitForComputeSa(ctx, cfg, d) {
  const { gcloud } = ctx;
  if (gcloud.dryRun && !ctx.state.projectExists) return;
  for (let i = 0; i < 40; i++) {
    const sa = await gcloud.json(["iam", "service-accounts", "describe", d.computeSa, `--project=${cfg.projectId}`]);
    if (sa) {
      if (sa.disabled) throw new HarpError(`${d.computeSa} is disabled. Re-enable it in IAM → Service Accounts.`);
      return;
    }
    if (gcloud.dryRun) {
      ui.warn(`${d.computeSa} does not exist yet — it appears once the Cloud Run API is enabled.`);
      return;
    }
    if (i === 0) ui.info(c.dim("Waiting for Google to create the default compute service account…"));
    await sleep(5000);
  }
  throw new HarpError(
    `The default compute service account ${d.computeSa} never appeared.`,
    "Some organizations disable its creation (iam.automaticIamGrantsForDefaultServiceAccounts / skipDefaultNetworkCreation). Check with your org admin.",
  );
}

// ── IAM ──────────────────────────────────────────────────────────────────────

export async function ensureProjectIam(ctx, cfg, d) {
  ui.step("IAM");
  const { gcloud } = ctx;
  await waitForComputeSa(ctx, cfg, d);

  const policy = ctx.state.projectExists ? await gcloud.json(["projects", "get-iam-policy", cfg.projectId]) : null;
  const have = new Set();
  for (const b of policy?.bindings ?? []) {
    if (b.condition) continue;
    for (const m of b.members) have.add(`${b.role}|${m}`);
  }

  const wanted = COMPUTE_SA_ROLES.map((role) => ({ role, member: `serviceAccount:${d.computeSa}` }));
  // Only exists on projects created before Cloud Build switched to the compute
  // SA by default; harmless to skip when it is absent.
  wanted.push({ role: "roles/cloudbuild.builds.builder", member: `serviceAccount:${d.legacyCloudBuildSa}`, optional: true });

  let added = 0;
  for (const { role, member, optional } of wanted) {
    if (have.has(`${role}|${member}`)) continue;
    const r = await gcloud.run(
      [
        "projects", "add-iam-policy-binding", cfg.projectId,
        `--member=${member}`, `--role=${role}`, "--condition=None", "--format=none",
      ],
      { mutating: true, allowFailure: optional, retryOn: optional ? null : /does not exist|not found|INVALID_ARGUMENT/i },
    );
    if (r.code !== 0) ui.skip(`Skipped ${role} for ${member} (account not present).`);
    else added += 1;
  }
  if (added === 0 && !gcloud.dryRun) ui.skip("All IAM bindings already present.");
  else if (!gcloud.dryRun) ui.ok(`Added ${added} IAM binding(s).`);
}

// ── Cloud Storage ────────────────────────────────────────────────────────────

export async function ensureBucket(ctx, cfg, d) {
  ui.step("Cloud Storage bucket");
  const { gcloud, scratch } = ctx;
  const uri = `gs://${cfg.bucketName}`;
  const res = await gcloud.run(["storage", "buckets", "describe", uri, "--raw", "--format=json"], { allowFailure: true });

  if (res.code === 0) {
    const bucket = JSON.parse(res.stdout);
    if (String(bucket.projectNumber) !== String(d.projectNumber)) {
      throw new HarpError(`Bucket ${uri} belongs to a different project.`, "Choose another bucket name.");
    }
    ui.skip(`${uri} already exists.`);
  } else if (/404|not found/i.test(res.stderr)) {
    await gcloud.run(
      [
        "storage", "buckets", "create", uri,
        `--project=${cfg.projectId}`,
        `--location=${cfg.bucketLocation}`,
        "--default-storage-class=STANDARD",
        "--uniform-bucket-level-access",
        "--public-access-prevention",
        "--soft-delete-duration=7d",
      ],
      { mutating: true },
    );
    if (!gcloud.dryRun) ui.ok(`Created ${uri} (private, uniform access).`);
  } else {
    throw new HarpError(
      `The bucket name ${cfg.bucketName} is already taken by someone else.`,
      "Bucket names are global. Re-run and choose another name.",
    );
  }

  // Browsers PUT resumes straight to GCS with signed URLs, so the portal's
  // origin must be allowed. Built from the service URL — no hand-typed origins.
  const cors = [
    {
      origin: ["http://localhost:3000", d.appUrl],
      method: ["OPTIONS", "HEAD", "GET", "PUT"],
      responseHeader: ["Content-Type", "x-goog-content-length-range", "ETag"],
      maxAgeSeconds: 3600,
    },
  ];
  const corsFile = scratch.write("gcs-cors.json", JSON.stringify(cors, null, 2));
  if (gcloud.dryRun) ui.info(c.dim(`CORS origins: ${cors[0].origin.join(", ")}`));
  await gcloud.run(["storage", "buckets", "update", uri, `--cors-file=${corsFile}`], { mutating: true });
  if (!gcloud.dryRun) ui.ok(`CORS allows ${d.appUrl} and http://localhost:3000.`);
}

// ── Secret Manager ───────────────────────────────────────────────────────────

export async function ensureSendgridSecret(ctx, cfg, d) {
  if (cfg.emailProvider !== "sendgrid") return;
  ui.step("Secret Manager");
  const { gcloud, secrets } = ctx;
  const name = "SENDGRID_API_KEY";
  const exists = ctx.state.projectExists && (await gcloud.json(["secrets", "describe", name, `--project=${cfg.projectId}`]));

  if (!exists) {
    await gcloud.run(["secrets", "create", name, `--project=${cfg.projectId}`, "--replication-policy=automatic"], {
      mutating: true,
      retryOn: FRESH_API,
      attempts: 10,
    });
  } else {
    ui.skip(`Secret ${name} already exists.`);
  }

  if (secrets.SENDGRID_API_KEY) {
    // Piped on stdin: the key never appears in argv or on disk.
    await gcloud.run(["secrets", "versions", "add", name, `--project=${cfg.projectId}`, "--data-file=-"], {
      mutating: true,
      input: secrets.SENDGRID_API_KEY,
    });
    if (!gcloud.dryRun) ui.ok(`Stored a new ${name} version.`);
  } else {
    const versions = await gcloud.value(
      ["secrets", "versions", "list", name, `--project=${cfg.projectId}`, "--filter=state=ENABLED"],
      "name",
    );
    if (!versions && !gcloud.dryRun) throw new HarpError(`${name} has no enabled version. Re-run and enter the key.`);
    ui.skip(`Keeping the current ${name} version.`);
  }

  const policy = exists ? await gcloud.json(["secrets", "get-iam-policy", name, `--project=${cfg.projectId}`]) : null;
  const member = `serviceAccount:${d.computeSa}`;
  const granted = (policy?.bindings ?? []).some(
    (b) => b.role === "roles/secretmanager.secretAccessor" && b.members.includes(member),
  );
  if (granted) {
    ui.skip("Runtime service account can already read the secret.");
    return;
  }
  // Without this the first revision fails: project Editor does not include
  // secret access.
  await gcloud.run(
    [
      "secrets", "add-iam-policy-binding", name, `--project=${cfg.projectId}`,
      `--member=${member}`, "--role=roles/secretmanager.secretAccessor", "--condition=None", "--format=none",
    ],
    { mutating: true, retryOn: /does not exist|not found|INVALID_ARGUMENT/i },
  );
  if (!gcloud.dryRun) ui.ok("Granted the runtime service account access to the secret.");
}

// ── Artifact Registry ────────────────────────────────────────────────────────

export async function ensureArtifactRepo(ctx, cfg) {
  ui.step("Artifact Registry");
  const { gcloud, scratch } = ctx;
  const exists =
    ctx.state.projectExists &&
    (await gcloud.json([
      "artifacts", "repositories", "describe", cfg.arRepository,
      `--location=${cfg.region}`, `--project=${cfg.projectId}`,
    ]));
  if (exists) {
    ui.skip(`Repository ${cfg.arRepository} already exists.`);
  } else {
    await gcloud.run(
      [
        "artifacts", "repositories", "create", cfg.arRepository,
        `--project=${cfg.projectId}`, `--location=${cfg.region}`,
        "--repository-format=docker", "--description=Cloud Run Source Deployments",
      ],
      { mutating: true, retryOn: FRESH_API, attempts: 10 },
    );
    if (!gcloud.dryRun) ui.ok(`Created Docker repository ${cfg.arRepository}.`);
  }

  // Every push adds an image; without cleanup the repository outgrows the
  // free storage tier. Keep the five newest for rollbacks, drop anything else
  // older than 30 days.
  const policy = [
    { name: "keep-recent", action: { type: "KEEP" }, mostRecentVersions: { keepCount: 5 } },
    { name: "delete-old", action: { type: "DELETE" }, condition: { tagState: "ANY", olderThan: "30d" } },
  ];
  const file = scratch.write("ar-cleanup.json", JSON.stringify(policy));
  await gcloud.run(
    [
      "artifacts", "repositories", "set-cleanup-policies", cfg.arRepository,
      `--project=${cfg.projectId}`, `--location=${cfg.region}`, `--policy=${file}`, "--format=none",
    ],
    { mutating: true, retryOn: FRESH_API, attempts: 10 },
  );
  if (!gcloud.dryRun) ui.ok("Cleanup policy: keep newest 5 images, delete the rest after 30 days.");
}

// ── Google OAuth (manual) ────────────────────────────────────────────────────

export async function configureGoogleOAuth(ctx, cfg, d) {
  if (!cfg.googleAuth) return;
  ui.step("Google sign-in (OAuth client)");
  const { prompt, secrets } = ctx;

  if (cfg.googleClientId && secrets.GOOGLE_CLIENT_SECRET) {
    const keep = await prompt.confirm(`Keep the deployed OAuth client ${c.dim(cfg.googleClientId.slice(0, 24) + "…")}?`, true);
    if (keep) return;
  }

  const project = `project=${cfg.projectId}`;
  ui.manual("create the Google OAuth web client", [
    "Google does not expose OAuth web-client creation through gcloud, so this part is manual.",
    "",
    `1. Open ${c.bold(`https://console.cloud.google.com/auth/overview/create?${project}`)}`,
    `   App name: ${cfg.appName}   ·   Support email: ${cfg.account}`,
    "   Audience: External   ·   Contact email: yours   ·   Create",
    `2. Open ${c.bold(`https://console.cloud.google.com/auth/clients/create?${project}`)}`,
    "   Application type: Web application",
    "   Authorized JavaScript origins:",
    `     ${d.appUrl}`,
    "     http://localhost:3000",
    "   Authorized redirect URIs:",
    `     ${d.appUrl}/auth/callback/google`,
    "     http://localhost:3000/auth/callback/google",
    "   Create, then copy the Client ID and Client secret.",
    `3. Open ${c.bold(`https://console.cloud.google.com/auth/audience?${project}`)}`,
    "   While the app is in Testing, only listed test users can sign in with Google.",
    "   Add your organizers as test users, or Publish the app before applications open.",
  ]);
  await offerToOpen(ctx, `https://console.cloud.google.com/auth/overview/create?${project}`);
  if (ctx.gcloud.dryRun) {
    cfg.googleClientId ??= "<from-this-step>.apps.googleusercontent.com";
    secrets.GOOGLE_CLIENT_SECRET ??= "<from-this-step>";
    return;
  }

  cfg.googleClientId = await prompt.text("OAuth Client ID", {
    initial: cfg.googleClientId,
    validate: (s) => (s.endsWith(".apps.googleusercontent.com") ? undefined : "Client IDs end in .apps.googleusercontent.com"),
  });
  secrets.GOOGLE_CLIENT_SECRET = await prompt.secret("OAuth Client secret", { initial: secrets.GOOGLE_CLIENT_SECRET });
}

// ── Cloud Run ────────────────────────────────────────────────────────────────

export function buildRuntimeEnv(cfg, secrets, d) {
  const env = {
    ADDR: ":8080",
    ENV: "prod",
    APP_URL: d.appUrl,
    APP_NAME: cfg.appName,
    HACKATHON_NAME: cfg.hackathonName,
    AUTH_BASIC_USER: "admin",
    AUTH_BASIC_PASS: secrets.AUTH_BASIC_PASS,
    DB_ADDR: secrets.DB_ADDR,
    DB_MAX_OPEN_CONNS: "15",
    DB_MAX_IDLE_CONNS: "15",
    DB_MAX_IDLE_TIME: "5m",
    SUPERTOKENS_CONNECTION_URI: cfg.supertokensUri,
    SUPERTOKENS_API_KEY: secrets.SUPERTOKENS_API_KEY,
    RATE_LIMITER_ENABLED: "true",
    RATELIMITER_REQUESTS_COUNT: "100",
    GCS_BUCKET_NAME: cfg.bucketName,
    VAPID_PUBLIC_KEY: cfg.vapidPublicKey,
    VAPID_PRIVATE_KEY: secrets.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: cfg.vapidSubject,
    EMAIL_FROM: cfg.emailFrom,
    EMAIL_FROM_NAME: cfg.emailFromName,
    PUBLIC_API_KEY: secrets.PUBLIC_API_KEY,
  };
  if (cfg.googleAuth && cfg.googleClientId && secrets.GOOGLE_CLIENT_SECRET) {
    env.GOOGLE_CLIENT_ID = cfg.googleClientId;
    env.GOOGLE_CLIENT_SECRET = secrets.GOOGLE_CLIENT_SECRET;
  }
  if (cfg.emailProvider === "smtp") {
    env.EMAIL_HOST = cfg.smtpHost;
    env.EMAIL_PORT = String(cfg.smtpPort);
    env.EMAIL_USERNAME = cfg.smtpUsername;
    env.EMAIL_PASSWORD = secrets.EMAIL_PASSWORD;
  }
  for (const [k, val] of Object.entries(env)) {
    if (val === undefined || val === null || val === "") throw new HarpError(`Internal: ${k} has no value.`);
  }
  return env;
}

const REDACT = new Set(["AUTH_BASIC_PASS", "DB_ADDR", "SUPERTOKENS_API_KEY", "GOOGLE_CLIENT_SECRET", "VAPID_PRIVATE_KEY", "PUBLIC_API_KEY", "EMAIL_PASSWORD"]);

export async function deployService(ctx, cfg, d) {
  ui.step("Cloud Run service");
  const { gcloud, scratch, secrets } = ctx;
  const env = buildRuntimeEnv(cfg, secrets, d);

  // A new service starts on Google's placeholder image; the first Cloud Build
  // run swaps in the real one. An existing service keeps its current image.
  const image = ctx.state.deployed?.image ?? PLACEHOLDER_IMAGE;
  // JSON is valid YAML, which is what --env-vars-file expects. Mode 0600 in a
  // private temp dir, deleted straight after.
  const envFile = scratch.write("run-env.json", JSON.stringify(env));

  if (gcloud.dryRun) {
    ui.info(c.dim("Environment (secrets redacted):"));
    for (const [k, val] of Object.entries(env)) ui.info(c.dim(`  ${k}=${REDACT.has(k) ? "<redacted>" : val}`));
  }

  const args = [
    "run", "deploy", cfg.serviceName,
    `--project=${cfg.projectId}`, `--region=${cfg.region}`, "--platform=managed",
    `--image=${image}`,
    `--service-account=${d.computeSa}`,
    "--port=8080", "--cpu=1", "--memory=512Mi", "--concurrency=80", "--timeout=300s",
    "--max=30", "--max-instances=20", "--cpu-boost", "--ingress=all",
    // Public site without an allUsers IAM grant (works under domain-restricted sharing).
    "--no-invoker-iam-check",
    "--startup-probe=tcpSocket.port=8080,timeoutSeconds=240,periodSeconds=240,failureThreshold=1",
    `--env-vars-file=${envFile}`,
  ];
  if (cfg.emailProvider === "sendgrid") args.push("--set-secrets=SENDGRID_API_KEY=SENDGRID_API_KEY:latest");
  else if (ctx.state.deployed) args.push("--clear-secrets");

  try {
    // A fresh secret grant can take a minute to reach Cloud Run — this is the
    // "Permission denied on secret" failure a manual setup usually hits first.
    await gcloud.run(args, {
      mutating: true,
      retryOn: /permission denied on secret|secretAccessor|iam\.serviceaccounts\.actAs|PERMISSION_DENIED/i,
      attempts: 8,
    });
  } finally {
    scratch.remove(envFile);
  }
  if (!gcloud.dryRun) {
    ui.ok(`Service ${cfg.serviceName} is configured${image === PLACEHOLDER_IMAGE ? " (placeholder image until the first build)" : ""}.`);
  }
}

// ── Cloud Build trigger ──────────────────────────────────────────────────────

const BUILD_CONFIG = `steps:
  - id: Build
    name: gcr.io/cloud-builders/docker
    args:
      - build
      - --no-cache
      - --build-arg
      - VITE_GOOGLE_AUTH_ENABLED=$_VITE_GOOGLE_AUTH_ENABLED
      - -t
      - $_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA
      - .
      - -f
      - Dockerfile
  - id: Push
    name: gcr.io/cloud-builders/docker
    args:
      - push
      - $_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA
  - id: Deploy
    name: gcr.io/google.com/cloudsdktool/cloud-sdk:slim
    entrypoint: gcloud
    args:
      - run
      - services
      - update
      - $_SERVICE_NAME
      - --platform=managed
      - --image=$_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA
      - --labels=managed-by=gcp-cloud-build-deploy-cloud-run,commit-sha=$COMMIT_SHA,gcb-build-id=$BUILD_ID,gcb-trigger-id=$_TRIGGER_ID
      - --region=$_DEPLOY_REGION
      - --quiet
options:
  logging: CLOUD_LOGGING_ONLY
  substitutionOption: ALLOW_LOOSE
images:
  - $_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$REPO_NAME/$_SERVICE_NAME:$COMMIT_SHA
tags:
  - gcp-cloud-build-deploy-cloud-run
  - gcp-cloud-build-deploy-cloud-run-managed
  - harp
`;

function substitutions(cfg, d, triggerId) {
  return [
    `_AR_HOSTNAME=${d.arHost}`,
    `_AR_PROJECT_ID=${cfg.projectId}`,
    `_AR_REPOSITORY=${cfg.arRepository}`,
    `_DEPLOY_REGION=${cfg.region}`,
    `_PLATFORM=managed`,
    `_SERVICE_NAME=${cfg.serviceName}`,
    `_TRIGGER_ID=${triggerId}`,
    `_VITE_GOOGLE_AUTH_ENABLED=${cfg.googleAuth ? "true" : "false"}`,
  ].join(",");
}

// What Cloud Build answers when the GitHub App is not installed on the repo.
const NOT_CONNECTED = /repository mapping|connect a repository|FAILED_PRECONDITION|INVALID_ARGUMENT/i;

// `gcloud builds triggers update github` rejects triggers that carry an
// inline build config (INVALID_ARGUMENT), so substitutions are changed by
// re-importing the full trigger definition instead.
async function patchSubstitutions(ctx, trigger, patch) {
  const { gcloud, scratch } = ctx;
  const { createTime: _createTime, ...definition } = trigger;
  definition.substitutions = { ...trigger.substitutions, ...patch };
  const file = scratch.write("trigger.json", JSON.stringify(definition));
  const project = trigger.resourceName?.split("/")[1];
  await gcloud.run(
    ["builds", "triggers", "import", `--source=${file}`, `--project=${project}`, "--region=global", "--format=none"],
    { mutating: true },
  );
}

export async function ensureTrigger(ctx, cfg, d) {
  ui.step("Cloud Build trigger (deploy on push)");
  const { gcloud, prompt, scratch } = ctx;
  const where = [`--project=${cfg.projectId}`, "--region=global"];

  const existing = ctx.state.projectExists && (await gcloud.json(["builds", "triggers", "describe", cfg.triggerName, ...where]));
  if (existing) {
    ctx.state.triggerId = existing.id;
    ui.skip(`Trigger ${cfg.triggerName} already exists.`);
    // Keep the Google sign-in build flag in step with this run's answer.
    const flag = cfg.googleAuth ? "true" : "false";
    if (existing.substitutions?._VITE_GOOGLE_AUTH_ENABLED !== flag) {
      await patchSubstitutions(ctx, existing, { _VITE_GOOGLE_AUTH_ENABLED: flag });
      ui.ok(`Trigger now builds with Google sign-in ${cfg.googleAuth ? "on" : "off"}.`);
    }
    return true;
  }

  const buildFile = scratch.write("cloudbuild.yaml", BUILD_CONFIG);
  const createArgs = [
    "builds", "triggers", "create", "github", ...where,
    `--name=${cfg.triggerName}`,
    `--description=Build and deploy to Cloud Run service ${cfg.serviceName} on push to ${cfg.branch}`,
    `--repo-owner=${cfg.githubOwner}`,
    `--repo-name=${cfg.githubRepo}`,
    `--branch-pattern=^${cfg.branch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    `--inline-config=${buildFile}`,
    "--include-logs-with-status",
    "--no-require-approval",
    `--service-account=projects/${cfg.projectId}/serviceAccounts/${d.computeSa}`,
    `--substitutions=${substitutions(cfg, d, "PENDING")}`,
    "--format=value(id)",
  ];

  const connectUrl = `https://console.cloud.google.com/cloud-build/triggers;region=global/connect?project=${cfg.projectId}`;
  const showManual = () =>
    ui.manual("connect GitHub to Cloud Build", [
      "The Cloud Build GitHub App is installed through a browser consent screen.",
      "",
      `1. Open ${c.bold(connectUrl)}`,
      "2. Source: GitHub (Cloud Build GitHub App) → Continue → authenticate.",
      `3. Install the app on ${c.bold(`${cfg.githubOwner}/${cfg.githubRepo}`)} (only that repository is enough).`,
      "   Already installed from an earlier project? Pick your account and just select the repo.",
      "4. Select the repository, tick the consent box, click Connect.",
      "5. Click Done — do NOT create a trigger there; this tool creates it.",
    ]);

  if (gcloud.dryRun) {
    showManual();
    await gcloud.run(createArgs, { mutating: true });
    return true;
  }

  let shownManual = false;
  for (;;) {
    const r = await gcloud.run(createArgs, { mutating: true, allowFailure: true });
    if (r.code === 0) {
      ctx.state.triggerId = r.stdout.trim().split("\n").pop();
      break;
    }
    if (!NOT_CONNECTED.test(r.stderr)) {
      throw new HarpError(`Creating the trigger failed:\n    ${r.stderr.trim().split("\n").slice(-4).join("\n    ")}`);
    }
    if (!shownManual) {
      showManual();
      shownManual = true;
      await offerToOpen(ctx, connectUrl);
    } else {
      ui.warn(`Cloud Build still cannot see ${cfg.githubOwner}/${cfg.githubRepo}:`);
      ui.info(c.dim(r.stderr.trim().split("\n").pop()));
    }
    if (prompt.nonInteractive) {
      throw new HarpError("GitHub is not connected to Cloud Build.", "Complete the manual step above, then re-run.");
    }
    const retry = await prompt.confirm("Connected? Retry creating the trigger", true);
    if (!retry) {
      ui.warn("Skipping the trigger. Re-run this tool after connecting GitHub.");
      return false;
    }
  }

  // The inline build labels each revision with its trigger ID, which only
  // exists once the trigger does.
  const created = await gcloud.json(["builds", "triggers", "describe", cfg.triggerName, ...where]);
  if (!created) throw new HarpError(`Trigger ${cfg.triggerName} was created but cannot be read back.`);
  await patchSubstitutions(ctx, created, { _TRIGGER_ID: created.id });
  ui.ok(`Trigger ${cfg.triggerName} deploys every push to ${cfg.branch}.`);
  return true;
}

export async function runFirstBuild(ctx, cfg) {
  ui.step("First build and deploy");
  const { gcloud } = ctx;
  const where = [`--project=${cfg.projectId}`, "--region=global"];
  const r = await gcloud.run(["builds", "triggers", "run", cfg.triggerName, ...where, `--branch=${cfg.branch}`, "--format=json"], {
    mutating: true,
  });
  if (gcloud.dryRun) return true;

  const op = JSON.parse(r.stdout);
  const buildId = op?.metadata?.build?.id;
  if (!buildId) throw new HarpError("Cloud Build did not return a build ID.");
  const logUrl = `https://console.cloud.google.com/cloud-build/builds;region=global/${buildId}?project=${cfg.projectId}`;
  ui.info(`Build ${c.bold(buildId)} started. Logs: ${logUrl}`);
  ui.info(c.dim("A cold build (npm ci + go build) usually takes 5–10 minutes."));

  const started = Date.now();
  let last = "";
  for (;;) {
    await sleep(POLL_MS);
    const status = await gcloud.value(["builds", "describe", buildId, ...where], "status");
    if (status && status !== last) {
      ui.info(c.dim(`status: ${status} (${Math.round((Date.now() - started) / 1000)}s)`));
      last = status;
    }
    if (status === "SUCCESS") {
      ui.ok("Build succeeded and the new image is live.");
      return true;
    }
    if (["FAILURE", "INTERNAL_ERROR", "TIMEOUT", "CANCELLED", "EXPIRED"].includes(status)) {
      ui.error(`Build ended with ${status}. See ${logUrl}`);
      return false;
    }
    if (Date.now() - started > 40 * 60 * 1000) {
      ui.warn(`Still ${status} after 40 minutes; not waiting any longer. Follow it at ${logUrl}`);
      return false;
    }
  }
}
