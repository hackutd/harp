"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meta = meta;
const Settings_1 = require("../../Settings");
/**
 * Removes the plugin namespace from a rule name.
 * @param ruleName The name of the rule.
 * @returns The rule name without the plugin namespace.
 */
function removePluginNamespace(ruleName) {
    return ruleName.replace(`${Settings_1.PLUGIN_NAME}/`, "");
}
/**
 * Adapts the rule name to be used in a URL.
 * @param ruleName The name of the rule.
 * @returns The adapted rule name for URL usage.
 */
function adaptRuleNameToUrl(ruleName) {
    // NOTE: Urls are already prepared for the next major release where "element-types" rule will be renamed to "dependencies", so no 301 redirect will be needed then.
    if (ruleName === "element-types") {
        return "dependencies";
    }
    return ruleName;
}
/**
 * Returns the documentation URL for an ESLint rule.
 * @param ruleName The name of the rule.
 * @returns The documentation URL for the ESLint rule.
 */
function docsUrl(ruleName) {
    return `${Settings_1.WEBSITE_URL}/docs/rules/${adaptRuleNameToUrl(removePluginNamespace(ruleName))}/`;
}
/**
 * Returns the meta object for an ESLint rule.
 * @param param0 The rule metadata definition.
 * @returns The meta object for the ESLint rule.
 */
function meta({ description, schema = [], ruleName, type, }) {
    return {
        meta: {
            // TODO: Consider changing default to "suggestion" in a future major release, because most rules are not fixing code issues, but only suggesting best practices.
            type: type || "problem",
            docs: {
                url: docsUrl(ruleName),
                description,
                category: "dependencies",
            },
            schema,
        },
    };
}
