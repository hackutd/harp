// Minimal interactive prompts on top of node:readline — no dependencies, so the
// tool that handles your credentials pulls nothing from npm at `npx` time.

import readline from "node:readline";
import { Writable } from "node:stream";

import { c, HarpError } from "./ui.js";

export class Prompter {
  constructor({ nonInteractive = false } = {}) {
    this.nonInteractive = nonInteractive;
    this.muted = false;
    this.rl = null;
    // Lines typed ahead (or piped in) while no question is open are queued
    // rather than dropped.
    this.lines = [];
    this.waiter = null;
    this.closed = false;
  }

  #readline() {
    if (this.rl) return this.rl;
    const self = this;
    // Echo goes through this stream so secret entry can be silenced.
    const output = new Writable({
      write(chunk, encoding, callback) {
        if (!self.muted) process.stdout.write(chunk, encoding);
        callback();
      },
    });
    this.rl = readline.createInterface({
      input: process.stdin,
      output,
      terminal: Boolean(process.stdin.isTTY),
    });
    this.rl.on("line", (line) => {
      if (this.waiter) {
        const { resolve } = this.waiter;
        this.waiter = null;
        resolve(line);
      } else {
        this.lines.push(line);
      }
    });
    this.rl.on("SIGINT", () => {
      process.stdout.write("\n");
      process.exit(130);
    });
    this.rl.on("close", () => {
      this.closed = true;
      if (this.waiter) {
        const { reject } = this.waiter;
        this.waiter = null;
        reject(new HarpError("Input closed before the question was answered."));
      }
    });
    return this.rl;
  }

  #ask(question) {
    const rl = this.#readline();
    // Through readline's own prompt so line editing redraws it correctly.
    if (this.closed) {
      // Piped input already hit EOF; answers are drained from the queue.
      if (!this.muted) process.stdout.write(question);
    } else {
      rl.setPrompt(question);
      rl.prompt();
    }
    return new Promise((resolve, reject) => {
      if (this.lines.length) {
        if (!process.stdin.isTTY) process.stdout.write("\n");
        resolve(this.lines.shift());
      } else if (this.closed) {
        reject(new HarpError("Input closed before the question was answered."));
      } else {
        this.waiter = { resolve, reject };
      }
    });
  }

  close() {
    if (this.rl) {
      this.waiter = null;
      this.rl.close();
      this.rl = null;
    }
  }

  #needsAnswer(label) {
    return new HarpError(
      `No value for "${label}" in non-interactive mode.`,
      "Provide it in the --config file (or the matching HARP_* environment variable for secrets).",
    );
  }

  async text(label, { initial, validate, optional = false, help } = {}) {
    if (this.nonInteractive) {
      const value = initial ?? "";
      if (!value && !optional) throw this.#needsAnswer(label);
      const problem = value && validate?.(value);
      if (problem) throw new HarpError(`${label}: ${problem}`);
      return value;
    }
    if (help) console.log(c.dim(`  ${help}`));
    for (;;) {
      const suffix = initial ? c.dim(` (${initial})`) : optional ? c.dim(" (optional)") : "";
      const raw = (await this.#ask(`  ${c.cyan("?")} ${label}${suffix} `)).trim();
      const value = raw || initial || "";
      if (!value && !optional) {
        console.log(c.red("    A value is required."));
        continue;
      }
      const problem = value && validate?.(value);
      if (problem) {
        console.log(c.red(`    ${problem}`));
        continue;
      }
      return value;
    }
  }

  // Hidden input. `keep` means an existing value is already deployed and an
  // empty answer should leave it untouched.
  async secret(label, { initial, keep = false, validate, optional = false, help } = {}) {
    if (this.nonInteractive) {
      const value = initial ?? "";
      if (!value && !keep && !optional) throw this.#needsAnswer(label);
      const problem = value && validate?.(value);
      if (problem) throw new HarpError(`${label}: ${problem}`);
      return value || null;
    }
    if (help) console.log(c.dim(`  ${help}`));
    for (;;) {
      const hint = keep
        ? c.dim(" (Enter keeps the deployed value)")
        : initial
          ? c.dim(" (Enter uses the value from the environment)")
          : optional
            ? c.dim(" (optional)")
            : "";
      process.stdout.write(`  ${c.cyan("?")} ${label}${hint} `);
      this.muted = true;
      let raw;
      try {
        raw = (await this.#ask("")).trim();
      } finally {
        this.muted = false;
        process.stdout.write("\n");
      }
      const value = raw || initial || "";
      if (!value) {
        if (keep || optional) return null;
        console.log(c.red("    A value is required."));
        continue;
      }
      const problem = validate?.(value);
      if (problem) {
        console.log(c.red(`    ${problem}`));
        continue;
      }
      console.log(c.dim(`    received ${value.length} characters`));
      return value;
    }
  }

  async confirm(label, initial = true) {
    if (this.nonInteractive) return initial;
    for (;;) {
      const raw = (await this.#ask(`  ${c.cyan("?")} ${label} ${c.dim(initial ? "(Y/n)" : "(y/N)")} `))
        .trim()
        .toLowerCase();
      if (!raw) return initial;
      if (["y", "yes"].includes(raw)) return true;
      if (["n", "no"].includes(raw)) return false;
    }
  }

  async select(label, choices, initial) {
    if (this.nonInteractive) {
      const match = choices.find((ch) => ch.value === initial) ?? (choices.length === 1 && choices[0]);
      if (!match) throw this.#needsAnswer(label);
      return match.value;
    }
    console.log(`  ${c.cyan("?")} ${label}`);
    choices.forEach((ch, i) => {
      const marker = ch.value === initial ? c.green("›") : " ";
      console.log(`    ${marker} ${c.bold(String(i + 1))}. ${ch.label}`);
    });
    const defaultIndex = Math.max(0, choices.findIndex((ch) => ch.value === initial));
    for (;;) {
      const raw = (await this.#ask(`    choose 1-${choices.length} ${c.dim(`(${defaultIndex + 1})`)} `)).trim();
      if (!raw) return choices[defaultIndex].value;
      const n = Number.parseInt(raw, 10);
      if (n >= 1 && n <= choices.length) return choices[n - 1].value;
    }
  }

  async pause(message = "Press Enter when that is done") {
    if (this.nonInteractive) return;
    await this.#ask(`  ${c.cyan("↵")} ${message} `);
  }
}
