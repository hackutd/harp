#!/usr/bin/env node
import { main } from "../src/cli.js";
import { c, HarpError } from "../src/ui.js";

main(process.argv.slice(2)).catch((err) => {
  console.error();
  if (err instanceof HarpError) {
    console.error(`  ${c.red("✗")} ${err.message}`);
    if (err.hint) console.error(`    ${c.dim(err.hint)}`);
  } else if (err?.code?.startsWith?.("ERR_PARSE_ARGS")) {
    console.error(`  ${c.red("✗")} ${err.message}  (see --help)`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
