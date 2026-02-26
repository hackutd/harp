"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Elements_1 = require("../Elements");
const Settings_1 = require("../Settings");
const Support_1 = require("./Support");
const { RULE_NO_UNKNOWN_FILES } = Settings_1.SETTINGS;
const noUnknownFilesRule = {
    ...(0, Support_1.meta)({
        ruleName: RULE_NO_UNKNOWN_FILES,
        schema: [],
        description: `Prevent creating files not recognized as any of the element types`,
    }),
    create: function (context) {
        const settings = (0, Settings_1.getSettings)(context);
        const file = (0, Elements_1.elementDescription)(context.filename, settings);
        if (file.isIgnored || !file.isUnknown) {
            return {};
        }
        return {
            Program: (node) => {
                context.report({
                    message: `File is not of any known element type`,
                    node: node,
                });
            },
        };
    },
};
exports.default = noUnknownFilesRule;
