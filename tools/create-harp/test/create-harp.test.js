import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createECDH } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { directDatabaseUrl } from "../src/database.js";
import { generateVapidKeys } from "../src/secrets.js";
import { buildRuntimeEnv } from "../src/steps.js";
import * as v from "../src/validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, "..", "bin", "create-harp.js");
const repoRoot = path.resolve(here, "..", "..", "..");

describe("validators", () => {
  it("accepts and rejects project IDs", () => {
    assert.equal(v.projectId("harp-2026"), undefined);
    assert.ok(v.projectId("Harp"));
    assert.ok(v.projectId("harp-"));
    assert.ok(v.projectId("abc"));
  });
  it("accepts and rejects bucket names", () => {
    assert.equal(v.bucketName("hack-the-south-bucket"), undefined);
    assert.ok(v.bucketName("Has-Caps"));
    assert.ok(v.bucketName("google-things"));
  });
  it("checks postgres URIs", () => {
    assert.equal(v.postgresUrl("postgresql://u:p@h/db?sslmode=require&channel_binding=require"), undefined);
    assert.ok(v.postgresUrl("mysql://u@h/db"));
    assert.ok(v.postgresUrl("not a url"));
  });
});

describe("directDatabaseUrl", () => {
  it("swaps Neon's pooled host for the direct one and keeps parameters", () => {
    const pooled = "postgresql://u:p@ep-damp-dew-123-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
    assert.equal(
      directDatabaseUrl(pooled),
      "postgresql://u:p@ep-damp-dew-123.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
  });
  it("leaves other hosts alone", () => {
    assert.equal(directDatabaseUrl("postgres://u:p@db.example.com:5432/x"), "postgres://u:p@db.example.com:5432/x");
  });
});

describe("generateVapidKeys", () => {
  it("produces a matching P-256 pair in webpush-go's encoding", () => {
    for (let i = 0; i < 20; i++) {
      const { publicKey, privateKey } = generateVapidKeys();
      const pub = Buffer.from(publicKey, "base64url");
      const priv = Buffer.from(privateKey, "base64url");
      assert.equal(pub.length, 65);
      assert.equal(pub[0], 0x04);
      assert.equal(priv.length, 32);
      assert.ok(!publicKey.includes("=") && !privateKey.includes("="));
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(priv);
      assert.equal(ecdh.getPublicKey(null, "uncompressed").toString("base64url"), publicKey);
    }
  });
});

describe("buildRuntimeEnv", () => {
  const cfg = {
    appName: "Hack", hackathonName: "Hack", supertokensUri: "https://st.example", bucketName: "b",
    vapidPublicKey: "pub", vapidSubject: "a@b.co", emailFrom: "a@b.co", emailFromName: "Hack",
    emailProvider: "sendgrid", googleAuth: true, googleClientId: "id.apps.googleusercontent.com",
  };
  const secrets = {
    AUTH_BASIC_PASS: "x", DB_ADDR: "postgres://h/db", SUPERTOKENS_API_KEY: "k", VAPID_PRIVATE_KEY: "p",
    PUBLIC_API_KEY: "q", GOOGLE_CLIENT_SECRET: "s",
  };
  const d = { appUrl: "https://harp-1.us-south1.run.app" };

  it("keeps the SendGrid key out of plain env (it comes from Secret Manager)", () => {
    const env = buildRuntimeEnv(cfg, secrets, d);
    assert.equal(env.SENDGRID_API_KEY, undefined);
    assert.equal(env.GOOGLE_CLIENT_ID, cfg.googleClientId);
    assert.equal(env.APP_URL, d.appUrl);
    assert.equal(env.FRONTEND_URL, undefined, "FRONTEND_URL must default to APP_URL so CORS middleware stays off");
  });
  it("omits Google credentials when sign-in is off, and sets SMTP when chosen", () => {
    const env = buildRuntimeEnv(
      { ...cfg, googleAuth: false, emailProvider: "smtp", smtpHost: "smtp.x", smtpPort: "587", smtpUsername: "u" },
      { ...secrets, EMAIL_PASSWORD: "pw" },
      d,
    );
    assert.equal(env.GOOGLE_CLIENT_ID, undefined);
    assert.equal(env.EMAIL_HOST, "smtp.x");
    assert.equal(env.EMAIL_PASSWORD, "pw");
  });
  it("refuses to deploy with a missing value", () => {
    assert.throws(() => buildRuntimeEnv(cfg, { ...secrets, DB_ADDR: undefined }, d), /DB_ADDR/);
  });
});

// ── End to end against a fake gcloud ────────────────────────────────────────

const POOLED = "postgresql://owner:pw-123@ep-test-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const SECRETS = {
  HARP_DB_ADDR: POOLED,
  HARP_SUPERTOKENS_API_KEY: "st-key-secret-value",
  HARP_SENDGRID_API_KEY: "SG.sendgrid-secret-value",
};

const sandboxes = [];
after(() => sandboxes.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function sandbox({ account = "owner@example.com", githubConnected = false, secretGrantLag = 0 } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "create-harp-test-"));
  sandboxes.push(dir);
  const binDir = path.join(dir, "bin");
  const tmp = path.join(dir, "tmp");
  spawnSync("mkdir", ["-p", binDir, tmp]);
  const fake = path.join(here, "fake-gcloud.mjs");
  writeFileSync(path.join(binDir, "gcloud"), `#!/bin/sh\nexec node "${fake}" "$@"\n`);
  writeFileSync(
    path.join(binDir, "migrate"),
    `#!/bin/sh\nif [ "$1" = "-version" ]; then echo 4.18.3; exit 0; fi\necho "$@" >> "${dir}/migrate.log"\necho "1/u create_extensions"\n`,
  );
  chmodSync(path.join(binDir, "gcloud"), 0o755);
  chmodSync(path.join(binDir, "migrate"), 0o755);
  const stateFile = path.join(dir, "state.json");
  writeFileSync(stateFile, JSON.stringify({ account, githubConnected, secretGrantLag, projects: {}, buckets: {} }));
  const configFile = path.join(dir, "harp.deploy.json");
  writeFileSync(
    configFile,
    JSON.stringify({
      projectId: "harp-e2e-test",
      projectName: "harp e2e",
      billingAccount: "AAAAAA-BBBBBB-CCCCCC",
      githubOwner: "example",
      githubRepo: "harp",
      hackathonName: "Hack the South",
      emailFrom: "team@example.com",
      supertokensUri: "https://st.example.com",
      emailProvider: "sendgrid",
      googleAuth: false,
    }),
  );
  return { dir, binDir, tmp, stateFile, configFile };
}

function run(sb, args, extraEnv = {}) {
  const r = spawnSync(process.execPath, [bin, "--config", sb.configFile, "--dir", repoRoot, ...args], {
    env: {
      PATH: `${sb.binDir}:${process.env.PATH}`,
      HOME: process.env.HOME,
      TMPDIR: sb.tmp,
      NO_COLOR: "1",
      FAKE_GCLOUD_STATE: sb.stateFile,
      CREATE_HARP_POLL_MS: "5",
      CREATE_HARP_RETRY_MS: "5",
      CREATE_HARP_GITHUB_API: "http://127.0.0.1:9",
      ...extraEnv,
    },
    input: "",
    encoding: "utf8",
  });
  return { ...r, all: r.stdout + r.stderr };
}

const calls = (sb) =>
  existsSync(sb.stateFile + ".log")
    ? readFileSync(sb.stateFile + ".log", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
const state = (sb) => JSON.parse(readFileSync(sb.stateFile, "utf8"));
const MUTATING = /^(create|enable|link|add-iam-policy-binding|update|add|deploy|run|set-cleanup-policies)$/;
const mutatingCalls = (list) =>
  list.filter((a) => a.includes("--quiet") || a.some((w) => MUTATING.test(w) && !a.includes("describe")));

describe("create-harp end to end (fake gcloud)", () => {
  it("stops before any project call when the account does not match --account", () => {
    const sb = sandbox({ account: "someone-else@example.com" });
    const r = run(sb, ["--yes", "--account", "owner@example.com"], SECRETS);
    assert.equal(r.status, 1, r.all);
    assert.match(r.all, /not owner@example\.com/);
    const seen = calls(sb).map((a) => a.join(" "));
    assert.deepEqual(seen, ["--version", "config get-value account"]);
  });

  it("makes no changes in --dry-run", () => {
    const sb = sandbox();
    const r = run(sb, ["--yes", "--dry-run", "--account", "owner@example.com"], SECRETS);
    assert.equal(r.status, 0, r.all);
    assert.match(r.all, /Dry run complete/);
    assert.deepEqual(mutatingCalls(calls(sb)), []);
    assert.ok(!r.all.includes("st-key-secret-value") && !r.all.includes("pw-123"), "secrets must not be printed");
    assert.deepEqual(state(sb).projects, {});
  });

  it("provisions everything, pauses at GitHub, then finishes idempotently on re-run", () => {
    const sb = sandbox();
    const first = run(sb, ["--yes", "--account", "owner@example.com"], SECRETS);
    assert.equal(first.status, 1, first.all);
    assert.match(first.all, /GitHub is not connected/);
    assert.match(first.all, /triggers;region=global\/connect\?project=harp-e2e-test/);

    let s = state(sb);
    const p = s.projects["harp-e2e-test"];
    assert.equal(p.billing, "AAAAAA-BBBBBB-CCCCCC");
    assert.ok(p.services.includes("run.googleapis.com"));
    const sa = "serviceAccount:123456789012-compute@developer.gserviceaccount.com";
    for (const role of ["roles/editor", "roles/iam.serviceAccountTokenCreator", "roles/run.admin"]) {
      assert.ok(p.iam.some(([r, m]) => r === role && m === sa), role);
    }

    const bucket = s.buckets["gs://harp-e2e-test-uploads"];
    assert.deepEqual(bucket.cors[0].origin, ["http://localhost:3000", "https://harp-123456789012.us-south1.run.app"]);
    assert.equal(bucket.flags["public-access-prevention"], true);

    assert.deepEqual(p.secrets.SENDGRID_API_KEY.versions, ["SG.sendgrid-secret-value"]);
    assert.deepEqual(p.secrets.SENDGRID_API_KEY.iam, [["roles/secretmanager.secretAccessor", sa]]);
    assert.equal(p.ar["cloud-run-source-deploy"].cleanup.length, 2);

    const svc = p.run.harp;
    assert.equal(svc.image, "us-docker.pkg.dev/cloudrun/container/placeholder");
    assert.equal(svc.secrets, "SENDGRID_API_KEY=SENDGRID_API_KEY:latest");
    assert.equal(svc.flags["no-invoker-iam-check"], true);
    assert.equal(svc.flags["allow-unauthenticated"], undefined);
    assert.equal(svc.env.DB_ADDR, POOLED, "the app keeps the pooled URI");
    assert.equal(svc.env.APP_URL, "https://harp-123456789012.us-south1.run.app");
    assert.equal(svc.env.SENDGRID_API_KEY, undefined);
    assert.equal(Buffer.from(svc.env.VAPID_PUBLIC_KEY, "base64url").length, 65);

    const migrateArgs = readFileSync(path.join(sb.dir, "migrate.log"), "utf8");
    assert.match(migrateArgs, /ep-test\.us-east-1\.aws\.neon\.tech/, "migrations use the direct endpoint");
    assert.doesNotMatch(migrateArgs, /-pooler/);

    const saved = readFileSync(sb.configFile, "utf8");
    for (const secret of ["pw-123", "st-key-secret-value", "SG.sendgrid", svc.env.AUTH_BASIC_PASS, svc.env.VAPID_PRIVATE_KEY]) {
      assert.ok(!saved.includes(secret), "answers file must not contain secrets");
      assert.ok(!first.all.includes(secret), "output must not contain secrets");
    }
    assert.deepEqual(readdirSync(sb.tmp), [], "scratch files are removed");

    // Connect GitHub and run again with only the DB/SuperTokens values in the
    // environment: everything else must be reused, not rotated.
    s.githubConnected = true;
    writeFileSync(sb.stateFile, JSON.stringify(s));
    const before = calls(sb).length;
    const { HARP_SENDGRID_API_KEY: _omit, ...rest } = SECRETS;
    const second = run(sb, ["--yes", "--account", "owner@example.com"], rest);
    assert.equal(second.status, 0, second.all);
    assert.match(second.all, /Done\./);

    const again = calls(sb).slice(before).map((a) => a.join(" "));
    assert.ok(!again.some((c) => c.startsWith("projects create")), "project is not recreated");
    assert.ok(!again.some((c) => c.startsWith("storage buckets create")), "bucket is not recreated");
    assert.ok(!again.some((c) => c.startsWith("secrets versions add")), "no new secret version without a new key");
    assert.ok(!again.some((c) => c.startsWith("projects add-iam-policy-binding") && !c.includes("cloudbuild.gserviceaccount")));

    s = state(sb);
    const svc2 = s.projects["harp-e2e-test"].run.harp;
    assert.equal(svc2.env.VAPID_PUBLIC_KEY, svc.env.VAPID_PUBLIC_KEY, "VAPID keys are not rotated");
    assert.equal(svc2.env.VAPID_PRIVATE_KEY, svc.env.VAPID_PRIVATE_KEY);
    assert.equal(svc2.env.AUTH_BASIC_PASS, svc.env.AUTH_BASIC_PASS);
    assert.equal(svc2.env.PUBLIC_API_KEY, svc.env.PUBLIC_API_KEY);
    assert.equal(s.projects["harp-e2e-test"].secrets.SENDGRID_API_KEY.versions.length, 1);

    const trig = s.projects["harp-e2e-test"].triggers["harp-deploy-main"];
    assert.equal(trig.flags["branch-pattern"], "^main$");
    assert.equal(trig.flags["repo-owner"], "example");
    assert.match(trig.flags.substitutions, /_VITE_GOOGLE_AUTH_ENABLED=false/);
    assert.match(trig.config, /VITE_GOOGLE_AUTH_ENABLED=\$_VITE_GOOGLE_AUTH_ENABLED/);
    assert.equal(trig.substitutions._TRIGGER_ID, "trig-0001");
    assert.equal(trig.imports, 1);
    assert.ok(again.some((c) => c.startsWith("builds triggers run harp-deploy-main")));
  });

  it("waits out IAM propagation when the first deploy cannot read the secret yet", () => {
    const sb = sandbox({ githubConnected: true, secretGrantLag: 2 });
    const r = run(sb, ["--yes", "--account", "owner@example.com"], SECRETS);
    assert.equal(r.status, 0, r.all);
    assert.match(r.all, /waiting \d+s for Google Cloud to propagate/);
    assert.equal(calls(sb).filter((a) => a[0] === "run" && a[1] === "deploy").length, 3);
    assert.ok(state(sb).projects["harp-e2e-test"].run.harp);
  });

  it("rejects a bucket name owned by someone else", () => {
    const sb = sandbox({ githubConnected: true });
    const cfg = JSON.parse(readFileSync(sb.configFile, "utf8"));
    writeFileSync(sb.configFile, JSON.stringify({ ...cfg, bucketName: "taken-bucket" }));
    const r = run(sb, ["--yes", "--account", "owner@example.com"], SECRETS);
    assert.equal(r.status, 1, r.all);
    assert.match(r.all, /already taken/);
  });
});
