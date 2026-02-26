import type { Config } from "../Settings";
/**
 * Recommended configuration for eslint-plugin-boundaries.
 *
 * It is recommended for applying the plugin to an already existing project.
 * Rules `boundaries/no-unknown`, `boundaries/no-unknown-files` and `boundaries/no-ignored` are disabled,
 * so it allows to have parts of the project non-compliant with defined rules, allowing to refactor the code progressively.
 */
declare const config: Config;
export default config;
