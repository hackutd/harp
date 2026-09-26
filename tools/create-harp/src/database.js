// Schema migrations and the first super admin. Both talk to the database from
// this machine, using a local `migrate` / `psql` when installed and the
// official Docker images otherwise. The connection URI is handed to Docker
// through the environment, never argv.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { spawnCapture } from "./gcloud.js";
import { c, HarpError, ui } from "./ui.js";

const MIGRATE_IMAGE = "migrate/migrate:v4.18.3";
const PSQL_IMAGE = "postgres:16-alpine";

// Neon's pooled endpoint (PgBouncer, transaction mode) is right for the app
// but not for migrations, which hold a session-level advisory lock. Neon's
// direct endpoint is the same host without "-pooler".
export function directDatabaseUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("-pooler.")) u.hostname = u.hostname.replace("-pooler.", ".");
    return u.toString();
  } catch {
    return url;
  }
}

async function has(cmd, args = ["--version"]) {
  const r = await spawnCapture(cmd, args);
  return r.code === 0;
}

async function dockerReady() {
  return (await spawnCapture("docker", ["info", "--format", "{{.ServerVersion}}"])).code === 0;
}

function streamed(cmd, args, { env, input } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"], env });
    let out = "";
    const pipe = (d) => {
      out += d;
      for (const line of String(d).split("\n")) if (line.trim()) console.log(c.dim(`    ${line}`));
    };
    child.stdout.on("data", pipe);
    child.stderr.on("data", pipe);
    child.on("error", (err) => resolve({ code: 127, out: String(err.message) }));
    child.on("close", (code) => resolve({ code: code ?? 1, out }));
    if (input !== undefined) child.stdin.end(input);
  });
}

export async function runMigrations(ctx) {
  ui.step("Database schema (migrations)");
  const { repoDir, secrets, gcloud } = ctx;
  const dir = path.join(repoDir, "cmd", "migrate", "migrations");
  if (!existsSync(dir)) throw new HarpError(`No migrations directory at ${dir}.`);
  const url = directDatabaseUrl(secrets.DB_ADDR);
  const env = { ...process.env, HARP_MIGRATE_DB: url };

  let cmd, args;
  if (await has("migrate", ["-version"])) {
    cmd = "migrate";
    args = ["-path", dir, "-database", url, "up"];
  } else if (await dockerReady()) {
    cmd = "docker";
    args = [
      "run", "--rm", "-e", "HARP_MIGRATE_DB", "-v", `${dir}:/migrations:ro`,
      "--entrypoint", "sh", MIGRATE_IMAGE, "-c", 'exec migrate -path=/migrations -database "$HARP_MIGRATE_DB" up',
    ];
  } else {
    ui.warn("Neither the `migrate` CLI nor a running Docker daemon was found, so migrations were not applied.");
    ui.info("Start Docker and re-run, or install golang-migrate and apply them yourself:");
    ui.info(c.dim("  brew install golang-migrate"));
    ui.info(c.bold(`  DB_ADDR='<direct connection URI>' task migrate-up`));
    return false;
  }

  ui.command(
    cmd === "migrate"
      ? `migrate -path ${dir} -database <DB_ADDR direct> up`
      : `docker run --rm -e HARP_MIGRATE_DB -v ${dir}:/migrations:ro ${MIGRATE_IMAGE} up`,
    gcloud.dryRun,
  );
  if (gcloud.dryRun) return true;

  const r = await streamed(cmd, args, { env });
  if (r.code !== 0) {
    if (/dirty/i.test(r.out)) {
      throw new HarpError(
        "The database is marked dirty from an earlier failed migration.",
        "Fix the failed migration by hand, then `migrate force <version>` — see cmd/migrate/migrations/README.md.",
      );
    }
    throw new HarpError("Migrations failed (output above).");
  }
  ui.ok(/no change/i.test(r.out) ? "Schema already up to date." : "Schema is up to date.");
  return true;
}

// Role changes are a plain UPDATE; the user row exists after first sign-in.
export async function promoteSuperAdmin(ctx, email) {
  const { secrets, gcloud } = ctx;
  const sql = "UPDATE users SET role = 'super_admin' WHERE email = :'email' RETURNING email;\n";
  const env = { ...process.env, HARP_PSQL_DB: secrets.DB_ADDR, HARP_PSQL_EMAIL: email };

  let cmd, args;
  if (await has("psql")) {
    cmd = "sh";
    args = ["-c", 'exec psql "$HARP_PSQL_DB" -X -q -t -v ON_ERROR_STOP=1 -v email="$HARP_PSQL_EMAIL"'];
  } else if (await dockerReady()) {
    cmd = "docker";
    args = [
      "run", "--rm", "-i", "-e", "HARP_PSQL_DB", "-e", "HARP_PSQL_EMAIL", PSQL_IMAGE,
      "sh", "-c", 'exec psql "$HARP_PSQL_DB" -X -q -t -v ON_ERROR_STOP=1 -v email="$HARP_PSQL_EMAIL"',
    ];
  } else {
    ui.warn("Neither psql nor Docker is available. Run this in your database console (Neon: SQL Editor):");
    ui.info(c.bold(`  UPDATE users SET role = 'super_admin' WHERE email = '${email.replaceAll("'", "''")}';`));
    return true;
  }

  ui.command(`${cmd === "docker" ? `docker run … ${PSQL_IMAGE} ` : ""}psql <DB_ADDR> -c "UPDATE users SET role = 'super_admin' WHERE email = '${email}'"`, gcloud.dryRun);
  if (gcloud.dryRun) return true;
  const r = await spawnCapture(cmd, args, { env, input: sql });
  if (r.code !== 0) throw new HarpError(`psql failed:\n    ${r.stderr.trim().split("\n").slice(-3).join("\n    ")}`);
  return r.stdout.trim().length > 0;
}
