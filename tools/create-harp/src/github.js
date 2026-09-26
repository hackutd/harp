// GitHub-side checks and browser hand-offs. Everything here is best effort:
// the public GitHub API is rate limited and cannot see private repositories,
// so a failed lookup never blocks provisioning.

import { spawn } from "node:child_process";

import { c, ui } from "./ui.js";

const API = process.env.CREATE_HARP_GITHUB_API || "https://api.github.com";

async function gh(path) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "create-harp" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? await res.json() : { status: res.status };
  } catch {
    return null;
  }
}

// Opens a URL in the default browser. Silent no-op when there is no desktop.
export function openInBrowser(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {
    // Nothing to do — the URL is printed as well.
  }
}

export async function offerToOpen(ctx, url) {
  if (ctx.prompt.nonInteractive || ctx.gcloud.dryRun) return;
  if (await ctx.prompt.confirm("Open it in your browser now?", true)) openInBrowser(url);
}

// A fork that is behind its upstream deploys old code on the first build.
// Returns once the fork is current, or the user chooses to go ahead anyway.
export async function checkFork(ctx, cfg) {
  const repo = await gh(`/repos/${cfg.githubOwner}/${cfg.githubRepo}`);
  if (!repo) return;
  if (repo.status === 404) {
    ui.warn(`github.com/${cfg.githubOwner}/${cfg.githubRepo} is not visible publicly (private, or a typo).`);
    return;
  }
  if (!repo.fork || !repo.parent) return;

  const parent = repo.parent;
  for (;;) {
    const cmp = await gh(
      `/repos/${cfg.githubOwner}/${cfg.githubRepo}/compare/${encodeURIComponent(cfg.branch)}...${parent.owner.login}:${parent.name}:${encodeURIComponent(parent.default_branch)}`,
    );
    const behind = cmp?.ahead_by; // commits the upstream has that the fork lacks
    if (!behind) {
      if (cmp?.status === "identical" || cmp?.status === "behind") ui.ok(`Fork is up to date with ${parent.full_name}.`);
      return;
    }
    const url = `https://github.com/${cfg.githubOwner}/${cfg.githubRepo}`;
    ui.manual("sync your fork", [
      `${c.bold(`${cfg.githubOwner}/${cfg.githubRepo}`)}@${cfg.branch} is ${behind} commit(s) behind ${parent.full_name}.`,
      "The first build deploys whatever is on that branch, so bring it up to date:",
      "",
      `Open ${c.bold(url)} → Sync fork → Update branch`,
    ]);
    if (ctx.prompt.nonInteractive || ctx.gcloud.dryRun) return;
    await offerToOpen(ctx, url);
    if (!(await ctx.prompt.confirm("Synced? Check again (No deploys the fork as it is)", true))) return;
  }
}
