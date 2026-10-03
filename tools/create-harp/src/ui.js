// Terminal output helpers. Everything user-facing goes through here so colour
// and dry-run markers stay consistent.

const useColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const wrap = (open, close) => (s) =>
  useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
};

let stepCount = 0;

export const ui = {
  banner(dryRun) {
    console.log();
    console.log(c.bold(c.magenta("  harp")) + c.dim("  ·  Google Cloud provisioner"));
    if (dryRun) {
      console.log(
        c.yellow("  DRY RUN — read-only gcloud calls only; every change is printed, not run."),
      );
    }
    console.log();
  },
  step(title) {
    stepCount += 1;
    console.log();
    console.log(c.bold(c.blue(`[${stepCount}] ${title}`)));
  },
  section(title) {
    console.log();
    console.log(c.bold(title));
  },
  info(msg) {
    console.log(`  ${msg}`);
  },
  ok(msg) {
    console.log(`  ${c.green("✓")} ${msg}`);
  },
  skip(msg) {
    console.log(`  ${c.dim("•")} ${c.dim(msg)}`);
  },
  warn(msg) {
    console.log(`  ${c.yellow("!")} ${c.yellow(msg)}`);
  },
  error(msg) {
    console.error(`  ${c.red("✗")} ${c.red(msg)}`);
  },
  command(line, dryRun) {
    const prefix = dryRun ? c.yellow("  [dry-run] $ ") : c.dim("  $ ");
    console.log(prefix + c.dim(line));
  },
  // A boxed block for instructions the user must follow in a browser.
  manual(title, lines) {
    console.log();
    console.log(c.bold(c.cyan(`  ┌─ Manual step: ${title}`)));
    for (const line of lines) console.log(c.cyan("  │ ") + line);
    console.log(c.cyan("  └─"));
  },
  kv(rows) {
    const width = Math.max(...rows.map(([k]) => k.length));
    for (const [k, v] of rows) console.log(`  ${c.dim(k.padEnd(width))}  ${v}`);
  },
};

export class HarpError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}
