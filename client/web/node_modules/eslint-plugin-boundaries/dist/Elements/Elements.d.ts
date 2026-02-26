import type { Matcher, DependencyDescription, DependencyKind, ElementDescription } from "@boundaries/elements";
import type { Rule } from "eslint";
import type { SettingsNormalized } from "../Settings";
import type { EslintLiteralNode } from "./Elements.types";
/**
 * Returns the elements matcher based on the ESLint rule context, filtering out invalid descriptors
 * @param context The ESLint rule context
 * @returns The elements matcher
 */
export declare function getElementsMatcher(settings: SettingsNormalized): Matcher;
/**
 * Returns the specifiers used in an import or export statement
 * @param node The AST node representing the import or export
 * @returns The list of specifiers used in the import or export
 */
export declare function getSpecifiers(node: Rule.Node): string[];
/**
 * Returns the description of the current file being linted
 * @param fileName The file name (absolute path)
 * @param settings The ESLint rule context settings normalized
 * @returns The description of the current file being linted
 */
export declare function elementDescription(fileName: string, settings: SettingsNormalized): ElementDescription;
/**
 * Returns the description of a dependency node
 * @param param0 The dependency node info
 * @param context The ESLint rule context
 * @returns The description of the dependency node
 */
export declare function dependencyDescription({ node, kind, nodeKind, }: {
    /** The dependency node */
    node: EslintLiteralNode;
    /** The kind of the dependency */
    kind: DependencyKind;
    /** The kind of the node generating the dependency */
    nodeKind?: string;
}, 
/** The file name (absolute path) */
fileName: string, 
/** The ESLint rule context settings normalized */
settings: SettingsNormalized, 
/** The ESLint rule context */
context: Rule.RuleContext): DependencyDescription;
