// Thin wrapper around the gcloud CLI.
//
// Every call is pinned to the verified account with --account, so switching
// the active gcloud account mid-run cannot redirect changes. Calls marked
// `mutating` are printed before they run, and in dry-run mode they are only
// printed. Read-only calls always run so the plan reflects reality.

import { spawn } from "node:child_process";

import { c, HarpError, ui } from "./ui.js";

const RETRY_BASE_MS = Number(process.env.CREATE_HARP_RETRY_MS) || 10000;

const quote = (arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${String(arg).replaceAll("'", `'\\''`)}'`);

export function spawnCapture(cmd, args, { input, env } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], env: env ?? process.env });
    } catch (err) {
      resolve({ code: 127, stdout: "", stderr: String(err?.message ?? err) });
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => resolve({ code: 127, stdout, stderr: String(err?.message ?? err) }));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

export class GcloudError extends HarpError {
  constructor(args, result) {
    const detail = (result.stderr || result.stdout).trim().split("\n").slice(-6).join("\n    ");
    super(`gcloud ${args.slice(0, 4).join(" ")} … failed (exit ${result.code}):\n    ${detail}`);
    this.result = result;
  }
}

export class Gcloud {
  constructor({ account = null, dryRun = false } = {}) {
    this.account = account;
    this.dryRun = dryRun;
  }

  #args(args) {
    return this.account ? [...args, `--account=${this.account}`] : args;
  }

  // `retryOn` is a regex for errors that are just Google Cloud catching up
  // (billing, IAM and new service accounts take a while to propagate).
  async run(args, { input, mutating = false, allowFailure = false, retryOn = null, attempts = 6 } = {}) {
    const full = this.#args(mutating ? [...args, "--quiet"] : args);
    if (mutating) {
      ui.command(["gcloud", ...args].map(quote).join(" "), this.dryRun);
      if (this.dryRun) return { code: 0, stdout: "", stderr: "", dryRun: true };
    }
    let result;
    for (let attempt = 1; ; attempt++) {
      result = await spawnCapture("gcloud", full, { input });
      if (result.code === 0 || !retryOn || attempt >= attempts || !retryOn.test(result.stderr)) break;
      const wait = Math.min(RETRY_BASE_MS * attempt, RETRY_BASE_MS * 4);
      ui.info(c.dim(`waiting ${Math.round(wait / 1000)}s for Google Cloud to propagate the last change…`));
      await new Promise((r) => setTimeout(r, wait));
    }
    if (result.code !== 0 && !allowFailure) throw new GcloudError(args, result);
    return result;
  }

  // Read-only call that returns parsed JSON, or null when it fails (typically
  // "not found" — callers treat that as "does not exist yet").
  async json(args) {
    const result = await this.run([...args, "--format=json"], { allowFailure: true });
    if (result.code !== 0) return null;
    try {
      return JSON.parse(result.stdout || "null");
    } catch {
      return null;
    }
  }

  async value(args, format) {
    const result = await this.run([...args, `--format=value(${format})`], { allowFailure: true });
    return result.code === 0 ? result.stdout.trim() : null;
  }
}
