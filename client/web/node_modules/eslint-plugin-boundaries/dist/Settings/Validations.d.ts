import type { ElementDescriptor } from "@boundaries/elements";
import type { Rule } from "eslint";
import type { Settings, RuleMainKey, SettingsNormalized } from "./Settings.types";
export declare function elementsMatcherSchema(matcherOptions?: Record<string, unknown>): {
    oneOf: ({
        type: string;
        items?: undefined;
    } | {
        type: string;
        items: {
            oneOf: ({
                type: string;
                items?: undefined;
            } | {
                type: string;
                items: Record<string, unknown>[];
            })[];
        };
    })[];
};
export declare function rulesOptionsSchema(options?: {
    rulesMainKey?: RuleMainKey;
    targetMatcherOptions?: Record<string, unknown>;
}): {
    type: string;
    properties: {
        message: {
            type: string;
        };
        default: {
            type: string;
            enum: string[];
        };
        rules: {
            type: string;
            items: {
                type: string;
                properties: {
                    [x: string]: {
                        oneOf: ({
                            type: string;
                            items?: undefined;
                        } | {
                            type: string;
                            items: {
                                oneOf: ({
                                    type: string;
                                    items?: undefined;
                                } | {
                                    type: string;
                                    items: Record<string, unknown>[];
                                })[];
                            };
                        })[];
                    } | {
                        oneOf: ({
                            type: string;
                            items?: undefined;
                        } | {
                            type: string;
                            items: {
                                type: string;
                            };
                        })[];
                        type?: undefined;
                    } | {
                        type: string;
                        oneOf?: undefined;
                    };
                    allow: {
                        oneOf: ({
                            type: string;
                            items?: undefined;
                        } | {
                            type: string;
                            items: {
                                oneOf: ({
                                    type: string;
                                    items?: undefined;
                                } | {
                                    type: string;
                                    items: Record<string, unknown>[];
                                })[];
                            };
                        })[];
                    };
                    disallow: {
                        oneOf: ({
                            type: string;
                            items?: undefined;
                        } | {
                            type: string;
                            items: {
                                oneOf: ({
                                    type: string;
                                    items?: undefined;
                                } | {
                                    type: string;
                                    items: Record<string, unknown>[];
                                })[];
                            };
                        })[];
                    };
                    importKind: {
                        oneOf: ({
                            type: string;
                            items?: undefined;
                        } | {
                            type: string;
                            items: {
                                type: string;
                            };
                        })[];
                    };
                    message: {
                        type: string;
                    };
                };
                additionalProperties: boolean;
                anyOf: {
                    required: string[];
                }[];
            };
        };
    };
    additionalProperties: boolean;
}[];
export declare function isValidElementAssigner(element: unknown): element is ElementDescriptor;
export declare function validateSettings(settings: Rule.RuleContext["settings"]): Settings;
/**
 * Returns the normalized settings from the ESLint rule context
 * @param context The ESLint rule context
 * @returns The normalized settings
 */
export declare function getSettings(context: Rule.RuleContext): SettingsNormalized;
