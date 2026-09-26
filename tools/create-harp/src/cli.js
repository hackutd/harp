import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { collectConfig, collectExternal, configPath, loadConfigFile, saveConfigFile } from "./config.js";
import { promoteSuperAdmin, runMigrations } from "./database.js";
import { Gcloud, spawnCapture } from "./gcloud.js";
import { checkFork } from "./github.js";
import { Prompter } from "./prompt.js";
import { secretsFromEnv } from "./secrets.js";
import {
  configureGoogleOAuth,
  deployService,
  derive,
  ensureArtifactRepo,
  ensureBilling,
  ensureBucket,
  ensureProject,
  ensureProjectIam,
  ensureSendgridSecret,
  ensureServices,
  ensureTrigger,
  REQUIRED_SERVICES,
  runFirstBuild,
  Scratch,
} from "./steps.js";
import { c, HarpError, ui } from "./ui.js";
import * as v from "./validate.js";

const HELP = `
${c.bold("create-harp")} — provision HARP on Google Cloud (Cloud Run, Cloud Build, Cloud Storage)

Run it from the root of your HARP fork:

  npx @hackutd/create-harp [options]

Options
  --dry-run            Only read from Google Cloud; print every change instead of making it
  --account <email>    Refuse to run unless gcloud's active account is exactly this one
  --config <file>      Answers file (default: ./harp.deploy.json, written after each run)
  --dir <path>         Path to the HARP repository (default: current directory)
  -y, --yes            Non-interactive: take answers from --config and HARP_* env vars
  --skip-migrations    Do not apply database migrations
  --skip-build         Do not start the first Cloud Build run
  -h, --help           Show this help
  -v, --version        Show the version

Secrets are never written to disk. For --yes, supply them as environment variables:
  HARP_DB_ADDR  HARP_SUPERTOKENS_API_KEY  HARP_SENDGRID_API_KEY  HARP_EMAIL_PASSWORD
  HARP_GOOGLE_CLIENT_SECRET  HARP_AUTH_BASIC_PASS  HARP_PUBLIC_API_KEY  HARP_VAPID_PRIVATE_KEY
`;

function version() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  return pkg.version;
}

function assertHarpRepo(dir) {
  const needed = ["Dockerfile", "go.mod", path.join("cmd", "api"), path.join("cmd", "migrate", "migrations")];
  const missing = needed.filter((p) => !existsSync(path.join(dir, p)));
  if (missing.length) {
    throw new HarpError(
      `${dir} does not look like a HARP repository (missing ${missing.join(", ")}).`,
      "Clone your fork and run this from its root, or pass --dir.",
    );
  }
}

// The account gate runs before any other gcloud call touches a project.
async function verifyAccount(expected) {
  const ver = await spawnCapture("gcloud", ["--version"]);
  if (ver.code !== 0) {
    throw new HarpError("gcloud is not installed or not on PATH.", "Install it from https://cloud.google.com/sdk/docs/install");
  }
  const acct = await spawnCapture("gcloud", ["config", "get-value", "account"]);
  const active = acct.stdout.trim();
  if (!active || active === "(unset)") {
    throw new HarpError("gcloud has no active account.", "Run: gcloud auth login");
  }
  if (expected && active.toLowerCase() !== expected.toLowerCase()) {
    throw new HarpError(
      `gcloud's active account is ${active}, not ${expected}. Stopping before touching anything.`,
      `Run: gcloud config set account ${expected}`,
    );
  }
  const token = await spawnCapture("gcloud", ["auth", "print-access-token", `--account=${active}`]);
  if (token.code !== 0) {
    throw new HarpError(`The credentials for ${active} are missing or expired.`, `Run: gcloud auth login ${active}`);
  }
  return active;
}

function showPlan(ctx, cfg, d) {
  ui.section("Plan");
  ui.kv([
    ["Account", cfg.account],
    ["Project", `${cfg.projectId}${ctx.state.projectExists ? "" : c.yellow("  (new)")}`],
    ["Billing account", cfg.billingAccount],
    ["Service URL", d.appUrl],
    ["Cloud Run", `${cfg.serviceName} in ${cfg.region} · 1 vCPU / 512Mi · scales 0→30`],
    ["Bucket", `gs://${cfg.bucketName} (${cfg.bucketLocation}, private)`],
    ["Images", `${d.imageBase}`],
    ["Deploys from", `github.com/${cfg.githubOwner}/${cfg.githubRepo} @ ${cfg.branch}`],
    ["Email", cfg.emailProvider === "sendgrid" ? "SendGrid (key in Secret Manager)" : `SMTP ${cfg.smtpHost}:${cfg.smtpPort}`],
    ["Google sign-in", cfg.googleAuth ? "yes (manual OAuth client step)" : "no — passwordless only"],
    ["APIs", `${REQUIRED_SERVICES.length} (${REQUIRED_SERVICES.map((s) => s.split(".")[0]).join(", ")})`],
  ]);
  console.log();
  ui.info(c.dim("Cost: nothing here has a standing charge. Cloud Run scales to zero (min instances 0),"));
  ui.info(c.dim("and a hackathon's traffic, builds, secrets and images normally fit Google Cloud's"));
  ui.info(c.dim("monthly free allowances. Stored resumes bill at ~$0.026/GB-month. Billing must"));
  ui.info(c.dim("still be linked because Cloud Run, Cloud Build and Artifact Registry require it."));
}

function showSummary(ctx, cfg, d, results) {
  ui.section(c.green("Done."));
  ui.kv([
    ["Portal", c.bold(d.appUrl)],
    ["Console", `https://console.cloud.google.com/run/detail/${cfg.region}/${cfg.serviceName}?project=${cfg.projectId}`],
    ["Answers saved to", ctx.configFile],
  ]);
  const todo = [];
  if (!results.trigger) todo.push("Connect GitHub to Cloud Build, then re-run this tool to create the deploy trigger.");
  if (results.trigger && !results.build) todo.push(`Push to ${cfg.branch} (or re-run) to build and deploy the real image.`);
  if (!results.migrations) todo.push("Apply database migrations: DB_ADDR='<direct URI>' task migrate-up");
  if (cfg.emailProvider === "sendgrid") {
    todo.push(`SendGrid → Settings → Sender Authentication: verify ${cfg.emailFrom} (or your domain) or no email is delivered.`);
  }
  if (cfg.googleAuth) todo.push("Google Auth Platform → Audience: add test users or Publish the app so hackers can use Google sign-in.");
  if (!results.promoted) {
    todo.push(`Sign in at ${d.appUrl}, then promote yourself: UPDATE users SET role = 'super_admin' WHERE email = '<you>';`);
  }
  todo.push("Sign in as super admin and complete the onboarding form (event name, dates, contact email).");
  todo.push(
    "Marketing site: set HARP_PUBLIC_API_KEY to this service's PUBLIC_API_KEY (Cloud Run → Variables & Secrets).",
  );
  ui.section("Next steps");
  todo.forEach((t, i) => ui.info(`${c.bold(String(i + 1) + ".")} ${t}`));
  console.log();
}

export async function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      account: { type: "string" },
      config: { type: "string" },
      dir: { type: "string" },
      yes: { type: "boolean", short: "y", default: false },
      "skip-migrations": { type: "boolean", default: false },
      "skip-build": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
    strict: true,
  });
  if (values.help) return void console.log(HELP);
  if (values.version) return void console.log(version());

  const [major] = process.versions.node.split(".").map(Number);
  if (major < 20) throw new HarpError(`Node.js 20 or newer is required (found ${process.versions.node}).`);
  if (values.account && v.email(values.account)) throw new HarpError(`--account must be an email address.`);

  const dryRun = values["dry-run"];
  ui.banner(dryRun);

  const account = await verifyAccount(values.account);
  ui.ok(`gcloud account: ${c.bold(account)}${values.account ? c.dim(" (matches --account)") : ""}`);

  const repoDir = path.resolve(values.dir ?? process.cwd());
  assertHarpRepo(repoDir);
  ui.ok(`HARP repository: ${repoDir}`);

  const configFile = configPath(repoDir, values.config);
  const seed = loadConfigFile(configFile);
  if (values.account && seed.account && seed.account !== account) {
    throw new HarpError(`${configFile} was written for ${seed.account}, but you are ${account}.`);
  }

  const ctx = {
    gcloud: new Gcloud({ account, dryRun }),
    prompt: new Prompter({ nonInteractive: values.yes }),
    secrets: secretsFromEnv(),
    scratch: new Scratch(),
    state: {},
    repoDir,
    configFile,
  };
  const cleanup = () => ctx.scratch.cleanup();
  process.on("exit", cleanup);
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      cleanup();
      process.exit(130);
    });
  }

  try {
    if (!values.yes && !values.account) {
      const ok = await ctx.prompt.confirm(`Provision as ${c.bold(account)}?`, true);
      if (!ok) throw new HarpError("Stopped. Switch accounts with: gcloud config set account <email>");
    }

    const cfg = await collectConfig(ctx, seed);
    await collectExternal(ctx, cfg);

    let d = derive(ctx, cfg);
    showPlan(ctx, cfg, d);
    console.log();
    if (!(await ctx.prompt.confirm(dryRun ? "Show the full list of changes?" : "Apply these changes?", true))) {
      throw new HarpError("Stopped before making any changes.");
    }
    if (!dryRun) {
      saveConfigFile(configFile, cfg);
      ui.info(c.dim(`Saved non-secret answers to ${configFile}.`));
    }

    await ensureProject(ctx, cfg);
    await ensureBilling(ctx, cfg);
    await ensureServices(ctx, cfg);
    d = derive(ctx, cfg); // the project number is known once the project exists
    await ensureProjectIam(ctx, cfg, d);
    await ensureBucket(ctx, cfg, d);
    await ensureSendgridSecret(ctx, cfg, d);
    await ensureArtifactRepo(ctx, cfg);
    await configureGoogleOAuth(ctx, cfg, d);
    await deployService(ctx, cfg, d);
    if (!dryRun) saveConfigFile(configFile, cfg);

    const results = { migrations: false, trigger: false, build: false, promoted: false };
    results.migrations = values["skip-migrations"] ? false : await runMigrations(ctx);
    results.trigger = await ensureTrigger(ctx, cfg, d);
    if (results.trigger && !values["skip-build"]) {
      await checkFork(ctx, cfg);
      results.build = await runFirstBuild(ctx, cfg);
    }

    if (results.build && results.migrations && !values.yes && !dryRun) {
      ui.step("First super admin");
      if (await ctx.prompt.confirm("Promote your account to super admin now?", true)) {
        const email = await ctx.prompt.text("Email you will sign in with", { initial: cfg.account, validate: v.email });
        ui.info(`Open ${c.bold(d.appUrl)} and sign in as ${email} once, so your user row exists.`);
        for (;;) {
          await ctx.prompt.pause("Press Enter after signing in");
          if (await promoteSuperAdmin(ctx, email)) {
            ui.ok(`${email} is now a super admin. Refresh the portal to see the admin section.`);
            results.promoted = true;
            break;
          }
          ui.warn(`No user with email ${email} yet.`);
          if (!(await ctx.prompt.confirm("Try again?", true))) break;
        }
      }
    }

    if (dryRun) {
      ui.section(c.yellow("Dry run complete — nothing was changed."));
      console.log();
    } else {
      showSummary(ctx, cfg, d, results);
    }
  } finally {
    ctx.prompt.close();
    cleanup();
  }
}
