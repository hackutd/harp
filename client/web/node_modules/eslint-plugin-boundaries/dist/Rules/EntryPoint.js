"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elements_1 = require("@boundaries/elements");
const Messages_1 = require("../Messages");
const Settings_1 = require("../Settings");
const ElementTypes_1 = require("./ElementTypes");
const Support_1 = require("./Support");
const { RULE_ENTRY_POINT } = Settings_1.SETTINGS;
function errorMessage(ruleData, dependency) {
    const ruleReport = ruleData.ruleReport;
    if (!ruleReport) {
        return `No detailed rule report available. This is likely a bug in ${Settings_1.PLUGIN_NAME}. Please report it at ${Settings_1.PLUGIN_ISSUES_URL}`;
    }
    if (ruleReport.message) {
        return (0, Messages_1.customErrorMessage)(ruleReport.message, dependency);
    }
    if (ruleReport.isDefault) {
        return `No rule allows the entry point '${dependency.to.internalPath}' in dependencies ${(0, Messages_1.elementMessage)(dependency.to)}`;
    }
    return `The entry point '${dependency.to.internalPath}' is not allowed in ${(0, Messages_1.ruleElementMessage)(ruleReport.disallow, dependency.to.captured)}${(0, Messages_1.dependencyUsageKindMessage)(ruleReport.importKind, dependency, {
        prefix: " when importing ",
        suffix: "",
    })}. Disallowed in rule ${ruleReport.index + 1}`;
}
function modifyTemplates(templates) {
    if (!templates) {
        return undefined;
    }
    const templatesArray = Array.isArray(templates) ? templates : [templates];
    return templatesArray.map((template) => template.replaceAll("${target.", "${to."));
}
function modifyRules(rules) {
    const newRules = [];
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const newTargets = (0, elements_1.normalizeElementsSelector)(rule.target);
        const ruleHasDisallow = !!rule.disallow;
        const ruleHasAllow = !!rule.allow;
        let internalPathPatterns = undefined;
        let allowPattern = undefined;
        let disallowPattern = undefined;
        if (ruleHasDisallow && ruleHasAllow) {
            // Workaround to support both allow and disallow in the same rule
            const toAdd = [
                {
                    to: newTargets.map((target) => {
                        return {
                            ...target,
                            internalPath: modifyTemplates(rule.allow),
                        };
                    }),
                    allow: ["*"],
                    importKind: rule.importKind,
                    message: rule.message,
                    originalRuleIndex: i,
                },
                {
                    to: newTargets.map((target) => {
                        return {
                            ...target,
                            internalPath: modifyTemplates(rule.disallow),
                        };
                    }),
                    disallow: ["*"],
                    importKind: rule.importKind,
                    message: rule.message,
                    originalRuleIndex: i,
                },
            ];
            newRules.push(...toAdd);
        }
        if (ruleHasDisallow) {
            internalPathPatterns = modifyTemplates(rule.disallow);
            disallowPattern = ["*"];
        }
        else if (ruleHasAllow) {
            internalPathPatterns = modifyTemplates(rule.allow);
            allowPattern = ["*"];
        }
        newRules.push({
            to: newTargets.map((target) => {
                return {
                    ...target,
                    internalPath: internalPathPatterns,
                };
            }),
            allow: allowPattern,
            disallow: disallowPattern,
            importKind: rule.importKind,
            message: rule.message,
            // @ts-expect-error Workaround to support both allow and disallow in the same entry point rule
            originalRuleIndex: i,
        });
    }
    return newRules;
}
exports.default = (0, Support_1.dependencyRule)({
    ruleName: RULE_ENTRY_POINT,
    description: `Check entry point used for each element type`,
    schema: (0, Settings_1.rulesOptionsSchema)({
        rulesMainKey: "target",
    }),
}, function ({ dependency, node, context, settings, options }) {
    if (!dependency.to.isIgnored &&
        dependency.to.type &&
        dependency.dependency.relationship.to !==
            elements_1.DEPENDENCY_RELATIONSHIPS_MAP.INTERNAL) {
        const adaptedRuleOptions = {
            ...options,
            rules: options && options.rules ? modifyRules(options.rules) : [],
        };
        const ruleData = (0, ElementTypes_1.elementRulesAllowDependency)(dependency, settings, adaptedRuleOptions);
        if (!ruleData.result) {
            context.report({
                message: errorMessage(ruleData, dependency),
                node: node,
            });
        }
    }
}, {
    validateRules: { onlyMainKey: true, mainKey: "target" },
});
