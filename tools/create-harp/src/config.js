// Collects every answer the provisioner needs. Non-secret answers are saved to
// harp.deploy.json so a re-run (after a manual step, or next year) starts from
// the same values; secrets are only ever held in memory.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { spawnCapture } from "./gcloud.js";
import { generateVapidKeys, randomSecret } from "./secrets.js";
import { c, HarpError, ui } from "./ui.js";
import * as v from "./validate.js";

export const CONFIG_FILE = "harp.deploy.json";

export const DEFAULTS = {
  region: "us-south1",
  serviceName: "harp",
  arRepository: "cloud-run-source-deploy",
  bucketLocation: "US",
  branch: "main",
};

export function loadConfigFile(file) {
  if (!file || !existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new HarpError(`Could not parse ${file}: ${err.message}`);
  }
}

export function saveConfigFile(file, cfg) {
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o644 });
}

export async function detectGithubRepo(dir) {
  const { code, stdout } = await spawnCapture("git", ["-C", dir, "remote", "get-url", "origin"]);
  if (code !== 0) return {};
  const m = stdout.trim().match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : {};
}

// The env of the currently deployed service, so a re-run offers what is live
// instead of asking for (and rotating) everything again.
export async function readDeployedEnv(gcloud, cfg) {
  const svc = await gcloud.json([
    "run", "services", "describe", cfg.serviceName,
    `--project=${cfg.projectId}`, `--region=${cfg.region}`,
  ]);
  if (!svc) return null;
  const env = {};
  for (const e of svc.spec?.template?.spec?.containers?.[0]?.env ?? []) {
    if (typeof e.value === "string") env[e.name] = e.value;
    else if (e.valueFrom) env[e.name] = { secretRef: e.valueFrom.secretKeyRef };
  }
  return { env, image: svc.spec?.template?.spec?.containers?.[0]?.image ?? null };
}

async function chooseBilling(ctx, cfg) {
  const { gcloud, prompt } = ctx;
  const linked = await gcloud.json(["billing", "projects", "describe", cfg.projectId]);
  if (linked?.billingEnabled && linked.billingAccountName) {
    const id = linked.billingAccountName.replace("billingAccounts/", "");
    ui.ok(`Project already has billing account ${c.bold(id)} linked.`);
    return id;
  }
  const accounts = (await gcloud.json(["billing", "accounts", "list", "--filter=open=true"])) ?? [];
  if (accounts.length === 0) {
    throw new HarpError(
      `No open billing accounts are visible to ${gcloud.account}.`,
      "Cloud Run, Cloud Build and Artifact Registry require billing. Create one at https://console.cloud.google.com/billing and re-run.",
    );
  }
  const choices = accounts.map((a) => {
    const id = a.name.replace("billingAccounts/", "");
    return { value: id, label: `${a.displayName} ${c.dim(`(${id})`)}` };
  });
  return prompt.select("Billing account to link", choices, cfg.billingAccount ?? choices[0].value);
}

export async function collectConfig(ctx, seed) {
  const { gcloud, prompt, repoDir } = ctx;
  const cfg = { ...DEFAULTS, ...seed, account: gcloud.account };

  ui.section("Google Cloud");
  cfg.projectId = await prompt.text("Project ID (new or existing)", {
    initial: cfg.projectId,
    validate: v.projectId,
    help: "Globally unique. A new project is created if it does not exist yet.",
  });

  const project = await gcloud.json(["projects", "describe", cfg.projectId]);
  if (project) {
    if (project.lifecycleState !== "ACTIVE") {
      throw new HarpError(`Project ${cfg.projectId} exists but is ${project.lifecycleState}.`);
    }
    ui.ok(`Using existing project ${c.bold(project.name)} (${project.projectNumber}).`);
    cfg.projectName = project.name;
    ctx.state.projectExists = true;
    ctx.state.projectNumber = project.projectNumber;
  } else {
    ui.info(c.dim(`Project ${cfg.projectId} does not exist (or you cannot see it) — it will be created.`));
    cfg.projectName = await prompt.text("Project display name", {
      initial: cfg.projectName ?? cfg.projectId.slice(0, 30),
      validate: (s) => (s.length >= 4 && s.length <= 30 ? undefined : "4–30 characters."),
    });
    ctx.state.projectExists = false;
  }

  cfg.billingAccount = await chooseBilling(ctx, cfg);
  cfg.region = await prompt.text("Cloud Run region", {
    initial: cfg.region,
    validate: v.region,
    help: "us-south1 is Dallas. The service URL and Artifact Registry repository live here.",
  });
  cfg.serviceName = await prompt.text("Cloud Run service name", { initial: cfg.serviceName, validate: v.serviceName });
  cfg.bucketName = await prompt.text("Resume upload bucket name", {
    initial: cfg.bucketName ?? `${cfg.projectId}-uploads`,
    validate: v.bucketName,
    help: "Bucket names are global across all of Google Cloud.",
  });

  ui.section("GitHub (continuous deployment from your fork)");
  const detected = await detectGithubRepo(repoDir);
  cfg.githubOwner = await prompt.text("GitHub owner (user or org)", {
    initial: cfg.githubOwner ?? detected.owner,
    validate: v.githubPart,
  });
  cfg.githubRepo = await prompt.text("GitHub repository name", {
    initial: cfg.githubRepo ?? detected.repo,
    validate: v.githubPart,
  });
  cfg.branch = await prompt.text("Branch that deploys on push", { initial: cfg.branch });
  cfg.triggerName ??= `${cfg.serviceName}-deploy-${cfg.branch}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 64);

  // What is already live, if anything — used for defaults below.
  ctx.state.deployed = ctx.state.projectExists ? await readDeployedEnv(gcloud, cfg) : null;
  const live = ctx.state.deployed?.env ?? {};
  if (ctx.state.deployed) ui.ok(`Found existing Cloud Run service ${c.bold(cfg.serviceName)}; its settings are the defaults.`);

  ui.section("Event identity");
  cfg.hackathonName = await prompt.text("Hackathon name", {
    initial: cfg.hackathonName ?? live.HACKATHON_NAME,
    help: "Bootstrap value — after onboarding, super admins edit it in the portal.",
  });
  cfg.appName = await prompt.text("App name (shown in sign-in emails)", {
    initial: cfg.appName ?? live.APP_NAME ?? cfg.hackathonName,
  });
  cfg.emailFrom = await prompt.text("Sender email address", {
    initial: cfg.emailFrom ?? live.EMAIL_FROM,
    validate: v.email,
    help: "Must be a verified sender (single sender or authenticated domain) with your email provider.",
  });
  cfg.emailFromName = await prompt.text("Sender display name", {
    initial: cfg.emailFromName ?? live.EMAIL_FROM_NAME ?? cfg.hackathonName,
  });
  cfg.vapidSubject = await prompt.text("Contact email for web-push services", {
    initial: cfg.vapidSubject ?? live.VAPID_SUBJECT ?? cfg.emailFrom,
  });

  return cfg;
}

// Secrets and third-party connection values. Each defaults to (in order) the
// HARP_* environment variable, then the currently deployed value.
export async function collectExternal(ctx, cfg) {
  const { prompt, secrets } = ctx;
  const live = ctx.state.deployed?.env ?? {};
  const liveSecret = (k) => typeof live[k] === "string" && live[k] !== "";

  ui.section("Database (PostgreSQL — e.g. Neon)");
  ui.info(c.dim("Neon: create a project (Postgres 16), click Connect, copy the pooled connection string."));
  const db = await prompt.secret("DB_ADDR connection URI", {
    initial: secrets.DB_ADDR,
    keep: liveSecret("DB_ADDR"),
    validate: v.postgresUrl,
  });
  if (db) secrets.DB_ADDR = db;
  else if (liveSecret("DB_ADDR")) secrets.DB_ADDR = live.DB_ADDR;

  ui.section("Authentication (SuperTokens)");
  ui.info(c.dim("supertokens.com → Managed Service → create a core → copy Connection URI and API key."));
  cfg.supertokensUri = await prompt.text("SuperTokens connection URI", {
    initial: cfg.supertokensUri ?? live.SUPERTOKENS_CONNECTION_URI,
    validate: v.httpsUrl,
  });
  const st = await prompt.secret("SuperTokens API key", {
    initial: secrets.SUPERTOKENS_API_KEY,
    keep: liveSecret("SUPERTOKENS_API_KEY"),
  });
  secrets.SUPERTOKENS_API_KEY = st ?? live.SUPERTOKENS_API_KEY;

  ui.section("Email");
  const liveProvider = live.SENDGRID_API_KEY ? "sendgrid" : live.EMAIL_HOST ? "smtp" : undefined;
  cfg.emailProvider = await prompt.select(
    "Email provider",
    [
      { value: "sendgrid", label: "SendGrid (API key stored in Secret Manager)" },
      { value: "smtp", label: "SMTP server" },
    ],
    cfg.emailProvider ?? liveProvider ?? "sendgrid",
  );
  if (cfg.emailProvider === "sendgrid") {
    ui.info(c.dim("SendGrid → Settings → API Keys → Create (Mail Send access is enough)."));
    // The deployed value lives in Secret Manager, so "keep" means "keep the secret version".
    const sg = await prompt.secret("SendGrid API key", {
      initial: secrets.SENDGRID_API_KEY,
      keep: Boolean(live.SENDGRID_API_KEY),
      validate: (k) => (k.startsWith("SG.") ? undefined : 'SendGrid keys start with "SG."'),
    });
    if (sg) secrets.SENDGRID_API_KEY = sg;
  } else {
    cfg.smtpHost = await prompt.text("SMTP host", { initial: cfg.smtpHost ?? live.EMAIL_HOST });
    cfg.smtpPort = await prompt.text("SMTP port", { initial: cfg.smtpPort ?? live.EMAIL_PORT ?? "587", validate: v.port });
    cfg.smtpUsername = await prompt.text("SMTP username", { initial: cfg.smtpUsername ?? live.EMAIL_USERNAME });
    const pw = await prompt.secret("SMTP password", { initial: secrets.EMAIL_PASSWORD, keep: liveSecret("EMAIL_PASSWORD") });
    secrets.EMAIL_PASSWORD = pw ?? live.EMAIL_PASSWORD;
  }

  ui.section("Google sign-in (optional)");
  cfg.googleAuth = await prompt.confirm(
    "Enable “Sign in with Google”? (needs a manual OAuth client step later)",
    cfg.googleAuth ?? (ctx.state.deployed ? Boolean(live.GOOGLE_CLIENT_ID) : true),
  );

  // Generated values: reuse what is deployed so nothing rotates silently.
  // Rotating VAPID keys would invalidate every browser push subscription.
  secrets.AUTH_BASIC_PASS ??= liveSecret("AUTH_BASIC_PASS") ? live.AUTH_BASIC_PASS : randomSecret(24);
  secrets.PUBLIC_API_KEY ??= liveSecret("PUBLIC_API_KEY") ? live.PUBLIC_API_KEY : randomSecret(32);
  if (!secrets.VAPID_PRIVATE_KEY) {
    if (liveSecret("VAPID_PRIVATE_KEY") && live.VAPID_PUBLIC_KEY) {
      secrets.VAPID_PRIVATE_KEY = live.VAPID_PRIVATE_KEY;
      cfg.vapidPublicKey = live.VAPID_PUBLIC_KEY;
    } else {
      const pair = generateVapidKeys();
      secrets.VAPID_PRIVATE_KEY = pair.privateKey;
      cfg.vapidPublicKey = pair.publicKey;
    }
  } else if (!cfg.vapidPublicKey) {
    throw new HarpError("HARP_VAPID_PRIVATE_KEY was set without vapidPublicKey in the config file.");
  }
  if (live.GOOGLE_CLIENT_ID) cfg.googleClientId ??= live.GOOGLE_CLIENT_ID;
  if (liveSecret("GOOGLE_CLIENT_SECRET")) secrets.GOOGLE_CLIENT_SECRET ??= live.GOOGLE_CLIENT_SECRET;
}

export function configPath(repoDir, explicit) {
  return explicit ? path.resolve(explicit) : path.join(repoDir, CONFIG_FILE);
}
