import type { DependencyKind } from "@boundaries/elements";
import type { DependencyNodeKey, SettingsKey, RulePolicy, RuleShortName, RuleName, RuleMainKey } from "./Settings.types";
/**
 * Type guard to check if a value is a valid DependencyKind.
 * @param value The value to check.
 * @returns True if the value is a valid DependencyKind, false otherwise.
 * @deprecated Use isDependencyKind instead.
 */
export declare function isImportKind(value: unknown): value is DependencyKind;
/**
 * Type guard to check if a value is a valid DependencyNodeKey.
 * @param value The value to check.
 * @returns True if the value is a valid DependencyNodeKey, false otherwise.
 */
export declare function isDependencyNodeKey(value: unknown): value is DependencyNodeKey;
/**
 * Type guard to check if a value is a valid key for the plugin settings.
 * @param value - The value to check.
 * @returns True if the value is a valid settings key, false otherwise.
 */
export declare function isSettingsKey(value: unknown): value is SettingsKey;
/**
 * Type guard to check if a value is a valid RulePolicy.
 * @param value - The value to check.
 * @returns True if the value is a valid RulePolicy, false otherwise.
 */
export declare function isRulePolicy(value: unknown): value is RulePolicy;
/**
 * Type guard to check if a value is a valid rule name including the default plugin prefix.
 * @param value - The value to check.
 * @returns True if the value is a valid rule name with the default plugin prefix, false otherwise.
 */
export declare function isRuleName(value: unknown): value is RuleName;
/**
 * Type guard to check if a value is a valid rule short name.
 * @param value - The value to check.
 * @returns True if the value is a valid rule short name, false otherwise.
 */
export declare function isRuleShortName(value: unknown): value is RuleShortName;
export declare function isLegacyType(type: unknown): type is string;
export declare function rulesMainKey(key?: RuleMainKey): RuleMainKey;
