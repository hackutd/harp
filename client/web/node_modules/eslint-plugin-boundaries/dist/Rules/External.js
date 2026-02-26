"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elements_1 = require("@boundaries/elements");
const Messages_1 = require("../Messages");
const Settings_1 = require("../Settings");
const Support_1 = require("../Support");
const ElementTypes_1 = require("./ElementTypes");
const Support_2 = require("./Support");
const { RULE_EXTERNAL } = Settings_1.SETTINGS;
function getErrorReportMessage(report) {
    if (report.path) {
        return report.path;
    }
    return report.specifiers && report.specifiers.length > 0
        ? report.specifiers.join(", ")
        : undefined;
}
function errorMessage(ruleData, dependency) {
    const ruleReport = ruleData.ruleReport;
    if (!ruleReport) {
        return `No detailed rule report available. This is likely a bug in ${Settings_1.PLUGIN_NAME}. Please report it at ${Settings_1.PLUGIN_ISSUES_URL}`;
    }
    if (ruleReport.message) {
        return (0, Messages_1.customErrorMessage)(ruleReport.message, dependency, {
            specifiers: ruleData.report?.specifiers && ruleData.report?.specifiers.length > 0
                ? ruleData.report?.specifiers?.join(", ")
                : undefined,
            path: ruleData.report?.path,
        });
    }
    if (ruleReport.isDefault) {
        return `No rule allows the usage of external module '${dependency.to.baseSource}' in elements ${(0, Messages_1.elementMessage)(dependency.from)}`;
    }
    const fileReport = `is not allowed in ${(0, Messages_1.ruleElementMessage)(ruleReport.element, dependency.from.captured)}. Disallowed in rule ${ruleReport.index + 1}`;
    if ((ruleData.report?.specifiers && ruleData.report?.specifiers.length > 0) ||
        ruleData.report?.path) {
        return `Usage of ${(0, Messages_1.dependencyUsageKindMessage)(ruleReport.importKind, dependency)}'${getErrorReportMessage(ruleData.report)}' from external module '${dependency.to.baseSource}' ${fileReport}`;
    }
    return `Usage of ${(0, Messages_1.dependencyUsageKindMessage)(ruleReport.importKind, dependency, {
        suffix: " from ",
    })}external module '${dependency.to.baseSource}' ${fileReport}`;
}
function modifySelectors(selectors) {
    const originsToMatch = [
        elements_1.ELEMENT_ORIGINS_MAP.EXTERNAL,
        elements_1.ELEMENT_ORIGINS_MAP.CORE,
    ];
    if ((0, Support_1.isString)(selectors)) {
        return [{ baseSource: selectors, origin: originsToMatch }];
    }
    return selectors.map((selector) => {
        if ((0, Support_1.isArray)(selector)) {
            return {
                origin: originsToMatch,
                baseSource: selector[0],
                specifiers: selector[1].specifiers,
                internalPath: selector[1].path,
            };
        }
        return {
            origin: originsToMatch,
            baseSource: selector,
        };
    });
}
exports.default = (0, Support_2.dependencyRule)({
    ruleName: RULE_EXTERNAL,
    description: `Check allowed external dependencies by element type`,
    schema: (0, Settings_1.rulesOptionsSchema)({
        targetMatcherOptions: {
            type: "object",
            properties: {
                specifiers: {
                    type: "array",
                    items: {
                        type: "string",
                    },
                },
                path: {
                    oneOf: [
                        {
                            type: "string",
                        },
                        {
                            type: "array",
                            items: {
                                type: "string",
                            },
                        },
                    ],
                },
            },
            additionalProperties: false,
        },
    }),
}, function ({ dependency, node, context, settings, options }) {
    if ((0, elements_1.isExternalDependencyElement)(dependency.to) ||
        (0, elements_1.isCoreDependencyElement)(dependency.to)) {
        const adaptedRuleOptions = {
            ...options,
            // @ts-expect-error TODO: Fix type
            rules: options && options.rules
                ? options.rules.map((rule) => ({
                    ...rule,
                    allow: rule.allow && modifySelectors(rule.allow),
                    disallow: rule.disallow && modifySelectors(rule.disallow),
                }))
                : [],
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
    validateRules: { onlyMainKey: true },
});
