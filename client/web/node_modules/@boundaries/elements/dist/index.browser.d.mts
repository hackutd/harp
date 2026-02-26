/**
 * Type representing a micromatch pattern, which can be a string or an array of strings.
 */
type MicromatchPattern = string | string[];
/**
 * Configuration options for categorizing dependencies as external or local.
 */
type FlagAsExternalOptions = {
    /** When true, non-relative dependencies whose path cannot be resolved are categorized as external (default: true) */
    unresolvableAlias?: boolean;
    /** When true, non-relative paths that include node_modules are categorized as external (default: true) */
    inNodeModules?: boolean;
    /** When true, dependencies whose resolved path is outside the configured root path are categorized as external (default: false) */
    outsideRootPath?: boolean;
    /** List of patterns (using micromatch syntax) that, when matching the source of the dependency, categorize it as external (default: []) */
    customSourcePatterns?: string[];
};
/** Configuration options for the Config class */
type ConfigOptions = {
    /** An array of path patterns to include when resolving elements. Defaults to all files if not specified */
    includePaths?: MicromatchPattern;
    /** An array of path patterns to ignore when resolving elements */
    ignorePaths?: MicromatchPattern;
    /**
     * Whether to enable legacy template support (default: true)
     * When enabled, it supports using "${...}" syntax in templates.
     **/
    legacyTemplates?: boolean;
    /** Whether to enable caching */
    cache?: boolean;
    /** Configuration for categorizing dependencies as external or local */
    flagAsExternal?: FlagAsExternalOptions;
    /** Root path of the project, used for determining if dependencies are outside the project */
    rootPath?: string;
};
type FlagAsExternalOptionsNormalized = {
    /** When true, non-relative dependencies whose path cannot be resolved are categorized as external */
    unresolvableAlias: boolean;
    /** When true, non-relative paths that include node_modules are categorized as external */
    inNodeModules: boolean;
    /** When true, dependencies whose resolved path is outside the configured root path are categorized as external */
    outsideRootPath: boolean;
    /** List of patterns (using micromatch syntax) that, when matching the source of the dependency, categorize it as external */
    customSourcePatterns: string[];
};
type ConfigOptionsNormalized = Omit<ConfigOptions, "legacyTemplates" | "cache" | "flagAsExternal"> & {
    /** Whether to enable legacy template support */
    legacyTemplates: boolean;
    /** Cache configuration options */
    cache: boolean;
    /** Configuration for categorizing dependencies as external or local */
    flagAsExternal: FlagAsExternalOptionsNormalized;
    /** Root path of the project, already normalized, and finishing with a slash, used for determining if dependencies are outside the project */
    rootPath: string | undefined;
};
/** Options for descriptors */
type DescriptorOptionsNormalized = Pick<ConfigOptionsNormalized, "includePaths" | "ignorePaths" | "cache" | "flagAsExternal" | "rootPath">;
/** Options for element matchers */
type MatchersOptionsNormalized = Pick<ConfigOptionsNormalized, "legacyTemplates">;

/**
 * Map of the modes to interpret the pattern in an ElementDescriptor.
 */
declare const ELEMENT_DESCRIPTOR_MODES_MAP: {
    /** Mode to interpret the pattern as a folder */
    readonly FOLDER: "folder";
    /** Mode to interpret the pattern as a file */
    readonly FILE: "file";
    /** Mode to interpret the pattern as a full path */
    readonly FULL: "full";
};
/**
 * Mode to interpret the pattern in an ElementDescriptor.
 */
type ElementDescriptorMode = (typeof ELEMENT_DESCRIPTOR_MODES_MAP)[keyof typeof ELEMENT_DESCRIPTOR_MODES_MAP];
/**
 * Pattern(s) to match files for an element descriptor.
 */
type ElementDescriptorPattern = string | string[];
/**
 * Descriptor for an element (or layer) in the project.
 * Defines the type of the element, the pattern to match files, and optional settings like mode and capture groups.
 */
type BaseElementDescriptor = {
    /** Micromatch pattern(s) to match files belonging to this element. */
    pattern: ElementDescriptorPattern;
    /**
     * Optional micromatch pattern. If provided, the left side of the element path must match also with this pattern from the root of the project (like if pattern is [basePattern]/** /[pattern]).
     * This option is useful when using the option mode with file or folder values, but capturing fragments from the rest of the full path is also needed
     **/
    basePattern?: string;
    /**
     * Mode to interpret the pattern. Can be "folder" (default), "file", or "full".
     * - "folder": Default value. the element type will be assigned to the first file's parent folder matching the pattern.
     *             In the practice, it is like adding ** /* to the given pattern, but the plugin makes it by itself because it needs to know exactly which parent folder has to be considered the element.
     * - "file": The given pattern will not be modified, but the plugin will still try to match the last part of the path.
     *           So, a pattern like *.model.js would match with paths src/foo.model.js, src/modules/foo/foo.model.js, src/modules/foo/models/foo.model.js, etc.
     * - "full": The given pattern will only match with patterns matching the full path.
     *           This means that you will have to provide patterns matching from the base project path.
     *           So, in order to match src/modules/foo/foo.model.js you'll have to provide patterns like ** /*.model.js, ** /* /*.model.js, src/* /* /*.model.js, etc. (the chosen pattern will depend on what do you want to capture from the path)
     */
    mode?: ElementDescriptorMode;
    /**
     * It allows to capture values of some fragments in the matching path to use them later in the rules configuration.
     * Must be an array of strings representing the names of the capture groups in the pattern.
     * The number of capture names must be equal to the number of capturing groups in the pattern.
     * For example, if the pattern is "src/modules/(* *)/(* *).service.js" the capture could be ["module", "service"].
     * Then, in the rules configuration, you could use ["service", { module: "auth" }] to match only services from the auth module.
     */
    capture?: string[];
    /**
     * Like capture, but for the basePattern.
     * This allows to capture values from the left side of the path, which is useful when using the basePattern option.
     * The captured values will be merged with the ones from the capture option. If the same name is used in both captures, the value from capture will take precedence.
     */
    baseCapture?: string[];
};
/**
 * Element descriptor with a type.
 */
type ElementDescriptorWithType = BaseElementDescriptor & {
    /** Type of the element (e.g., "service", "component", "util"). */
    type: string;
    /** Category of the element */
    category?: never;
};
/**
 * Element descriptor with a category.
 */
type ElementDescriptorWithCategory = BaseElementDescriptor & {
    /** Category of the element (e.g., "domain", "infrastructure", "application"). */
    category: string;
    /** Type of the element*/
    type?: never;
};
/**
 * Element descriptor with both type and category.
 */
type ElementDescriptorWithTypeAndCategory = BaseElementDescriptor & {
    /** Type of the element (e.g., "service", "component", "util"). */
    type: string;
    /** Category of the element (e.g., "domain", "infrastructure", "application"). */
    category: string;
};
/**
 * Element descriptor, which can be defined by type, category, or both.
 */
type ElementDescriptor = ElementDescriptorWithType | ElementDescriptorWithCategory | ElementDescriptorWithTypeAndCategory;
/**
 * Array of element descriptors.
 */
type ElementDescriptors = ElementDescriptor[];
/**
 * Serialized cache of element descriptions.
 */
type DescriptionsSerializedCache = Record<string, ElementDescription>;
/**
 * Serialized cache of file elements.
 */
type FileElementsSerializedCache = Record<string, FileElement>;
/**
 * Serialized cache for ElementsDescriptor class.
 */
type ElementsDescriptorSerializedCache = {
    /** Serialized descriptions cache */
    descriptions: DescriptionsSerializedCache;
    /** Serialized files cache */
    files: FileElementsSerializedCache;
};
/**
 * Captured values from an element path.
 */
type CapturedValues = Record<string, string>;
/**
 * Origins of an element
 */
declare const ELEMENT_ORIGINS_MAP: {
    /** Origin of local elements (files) */
    readonly LOCAL: "local";
    /** Origin of external elements (libraries) */
    readonly EXTERNAL: "external";
    /** Origin of core elements */
    readonly CORE: "core";
};
/**
 * Kind of element origin, either local, external, or core.
 */
type ElementOrigin = (typeof ELEMENT_ORIGINS_MAP)[keyof typeof ELEMENT_ORIGINS_MAP];
/**
 * Base element properties related to captured values
 */
type BaseElement = {
    /** Absolute path of the file. It might be null when a dependency path can't be resolved */
    path: string | null;
    /** Path of the file relative to the element, or null if the element is ignored or unknown */
    elementPath: string | null;
    /** Internal path of the file relative to the elementPath, or null if the element is ignored or unknown */
    internalPath: string | null;
    /** Source of the element when it is a dependency, or null if the element is not a dependency, or it is ignored or unknown */
    source: string | null;
    /** Base source of the element when it is an external or core dependency, null otherwise */
    baseSource: string | null;
    /** Type of the element, or null if the element is ignored or unknown */
    type: string | null;
    /** Category of the element, or null if the element is ignored or unknown */
    category: string | null;
    /** Captured values from the element, or null if the element descriptor has no capture or the element is ignored or unknown */
    captured: CapturedValues | null;
    /** Parent elements, or null if the element is ignored, unknown, or it is not a local element */
    parents: ElementParent[] | null;
    /** Origin of the element, or null if the element is ignored */
    origin: ElementOrigin | null;
    /** Indicates if the element is ignored by settings. If true, the element will be excluded from processing any other properties. */
    isIgnored: boolean;
    /** Indicates if the element is unknown, which means that it cannot be resolved to any descriptor */
    isUnknown: boolean;
};
/**
 * Parent elements
 */
type ElementParent = {
    /** Type of the parent element */
    type: string | null;
    /** Category of the parent element */
    category: string | null;
    /** Path of the element relative to the project */
    elementPath: string;
    /** Captured values from the parent element */
    captured: CapturedValues | null;
};
/**
 * Description of an ignored element
 */
type IgnoredElement = BaseElement & {
    /** Type of the element */
    type: null;
    /** Category of the element */
    category: null;
    /** Ignored elements have not captured values */
    captured: null;
    /** Origin of the element */
    origin: null;
    /** Indicates if the file is ignored */
    isIgnored: true;
    /** Indicates that the element is unknown */
    isUnknown: true;
};
/**
 * Description of an unknown local element
 */
type LocalElementUnknown = BaseElement & {
    /** Type of the element */
    type: null;
    /** Category of the element */
    category: null;
    /** Unknown elements have not captured values */
    captured: null;
    /** Indicates that the element is local */
    origin: typeof ELEMENT_ORIGINS_MAP.LOCAL;
    /** Indicates that the file is not ignored */
    isIgnored: false;
    /** Indicates that the element is unknown */
    isUnknown: true;
};
/**
 * Description of a local element (file)
 */
type LocalElementKnown = BaseElement & {
    /** Path of the element */
    path: string;
    /** Captured values from the parent element */
    captured: CapturedValues | null;
    /** Path of the file relative to the element */
    elementPath: string;
    /** Internal path of the file relative to the elementPath */
    internalPath: string;
    /** Parent elements */
    parents: ElementParent[];
    /** Indicates that the element is local */
    origin: typeof ELEMENT_ORIGINS_MAP.LOCAL;
    /** Indicates that the file is not ignored */
    isIgnored: false;
    /** Indicates that the element is known */
    isUnknown: false;
};
/**
 * Base description of a dependency
 */
type BaseDependencyElement = BaseElement & {
    /** Dependency source */
    source: string;
    /** Indicates that dependencies are not ignored */
    isIgnored: false;
};
/**
 * Description of a local dependency (known)
 */
type LocalDependencyElementKnown = LocalElementKnown & BaseDependencyElement;
/**
 * Description of a local dependency (unknown)
 */
type LocalDependencyElementUnknown = LocalElementUnknown & BaseDependencyElement;
/**
 * Description of a local dependency
 */
type LocalDependencyElement = LocalDependencyElementKnown | LocalDependencyElementUnknown;
/**
 * Description of an external dependency
 */
type ExternalDependencyElement = BaseDependencyElement & {
    /** Path of the dependency relative to the base module */
    internalPath: string;
    /** Base module of the external dependency */
    baseSource: string;
    /** Indicates that the dependency is external */
    origin: typeof ELEMENT_ORIGINS_MAP.EXTERNAL;
};
/**
 * Description of a core dependency
 */
type CoreDependencyElement = BaseDependencyElement & {
    /** Base module of the core dependency */
    baseSource: string;
    /** Indicates that the dependency is core */
    origin: typeof ELEMENT_ORIGINS_MAP.CORE;
};
/**
 * Description of an ignored dependency element
 */
type IgnoredDependencyElement = IgnoredElement & {
    /** The source of the dependency */
    source: string;
};
/**
 * Description of a file
 */
type FileElement = IgnoredElement | LocalElementKnown | LocalElementUnknown;
/**
 * Description of a dependency
 */
type DependencyElementDescription = IgnoredDependencyElement | CoreDependencyElement | LocalDependencyElement | ExternalDependencyElement;
/**
 * Description of an element, either local or dependency
 */
type ElementDescription = FileElement | DependencyElementDescription;

/**
 * Determines if the given value is a valid element descriptor mode.
 * @param value The value to check.
 * @returns True if the value is a valid element descriptor mode, false otherwise.
 */
declare function isElementDescriptorMode(value: unknown): value is ElementDescriptorMode;
/**
 * Determines if the given value is a valid element descriptor pattern.
 * @param value The value to check.
 * @returns True if the value is a valid element descriptor pattern, false otherwise.
 */
declare function isElementDescriptorPattern(value: unknown): value is ElementDescriptorPattern;
/**
 * Determines if the given value is a base element descriptor.
 * @param value The value to check.
 * @returns True if the value is a base element descriptor, false otherwise.
 */
declare function isBaseElementDescriptor(value: unknown): value is BaseElementDescriptor;
/**
 * Determines if the given value is an element descriptor with type.
 * @param value The value to check.
 * @returns True if the value is an element descriptor with type, false otherwise.
 */
declare function isElementDescriptorWithType(value: unknown): value is ElementDescriptorWithType;
/**
 * Determines if the given value is an element descriptor with category.
 * @param value The value to check.
 * @returns True if the value is an element descriptor with category, false otherwise.
 */
declare function isElementDescriptorWithCategory(value: unknown): value is ElementDescriptorWithCategory;
/**
 * Determines if the given value is an element descriptor.
 * @param value The value to check.
 * @returns True if the value is an element descriptor, false otherwise.
 */
declare function isElementDescriptor(value: unknown): value is ElementDescriptor;
/**
 * Determines if the value is a BaseElement
 * @param value The value to check
 * @returns True if the value is a valid BaseElement, false otherwise
 */
declare function isBaseElement(value: unknown): value is BaseElement;
/**
 * Determines if the given value is an ignored element.
 * @param value The element to check.
 * @returns True if the element is an ignored element, false otherwise.
 */
declare function isIgnoredElement(value: unknown): value is IgnoredElement;
/**
 * Determines if the given value is a local element.
 * @param value The value to check.
 * @returns True if the value is a local element, false otherwise.
 */
declare function isLocalElement(value: unknown): value is LocalElementKnown | LocalElementUnknown;
/**
 * Determines if the given element is local and unknown, because its type and category could not be determined.
 * @param value The value to check.
 * @returns True if the element is an unknown element, false otherwise.
 */
declare function isUnknownLocalElement(value: unknown): value is LocalElementUnknown;
/**
 * Determines if the given element is local and known, because its type and category were determined.
 * @param value The value to check.
 * @returns True if the element is an unknown element, false otherwise.
 */
declare function isKnownLocalElement(value: unknown): value is LocalElementKnown;
/**
 * Determines if the given value is a dependency element.
 * @param value The element to check.
 * @returns True if the element is a dependency element, false otherwise.
 */
declare function isDependencyElementDescription(value: unknown): value is DependencyElementDescription;
/**
 * Determines if the given value is an element (local or dependency).
 * @param value The value to check.
 * @returns True if the value is an element, false otherwise.
 */
declare function isElementDescription(value: unknown): value is ElementDescription;
/**
 * Determines if the given value is a local dependency element.
 * @param value The value to check.
 * @returns True if the element is a local dependency element, false otherwise.
 */
declare function isLocalDependencyElement(value: unknown): value is LocalDependencyElement;
/**
 * Determines if the given value is an external element.
 * @param value The value to check.
 * @returns True if the element is an external dependency element, false otherwise.
 */
declare function isExternalDependencyElement(value: unknown): value is ExternalDependencyElement;
/**
 * Determines if the given value is a core element.
 * @param value The value to check.
 * @returns True if the element is a core dependency element, false otherwise.
 */
declare function isCoreDependencyElement(value: unknown): value is CoreDependencyElement;

declare const DEPENDENCY_KIND_TYPE: "type";
declare const DEPENDENCY_KIND_VALUE: "value";
declare const DEPENDENCY_KIND_TYPEOF: "typeof";
/** Map of the kinds of dependency, either a type dependency or a value dependency */
declare const DEPENDENCY_KINDS_MAP: {
    /** Type import, e.g., `import type { X } from 'module'` */
    readonly TYPE: "type";
    /** Value import, e.g., `import { X } from 'module'` */
    readonly VALUE: "value";
    /** typeof import, e.g. `type ModuleType = typeof import("./my_module");` */
    readonly TYPE_OF: "typeof";
};
/** Kind of dependency, either a type dependency or a value dependency */
type DependencyKind = (typeof DEPENDENCY_KINDS_MAP)[keyof typeof DEPENDENCY_KINDS_MAP];
/** Map of possible kinds of relationships between elements being dependencies */
declare const DEPENDENCY_RELATIONSHIPS_MAP: {
    /** The dependency is internal to the element */
    readonly INTERNAL: "internal";
    /** The dependency is a child of the element */
    readonly CHILD: "child";
    /** The dependency is a descendant of the element */
    readonly DESCENDANT: "descendant";
    /** The dependency is a sibling of the element (both have the same parent) */
    readonly SIBLING: "sibling";
    /** The dependency is a parent of the element */
    readonly PARENT: "parent";
    /** The dependency is an uncle of the element */
    readonly UNCLE: "uncle";
    /** The dependency is a nephew of the element */
    readonly NEPHEW: "nephew";
    /** The dependency is an ancestor of the element */
    readonly ANCESTOR: "ancestor";
};
declare const DEPENDENCY_RELATIONSHIPS_INVERTED_MAP: {
    readonly internal: "internal";
    readonly child: "parent";
    readonly descendant: "ancestor";
    readonly sibling: "sibling";
    readonly parent: "child";
    readonly uncle: "nephew";
    readonly nephew: "uncle";
    readonly ancestor: "descendant";
};
/** Kind of relationship between elements being dependencies */
type DependencyRelationship = (typeof DEPENDENCY_RELATIONSHIPS_MAP)[keyof typeof DEPENDENCY_RELATIONSHIPS_MAP];
/** Information about a dependency between two elements */
type ElementsDependencyInfo = {
    /** Kind of the dependency */
    kind: DependencyKind;
    /** Type of the node creating the dependency in the dependent element */
    nodeKind: string | null;
    /** Specifiers imported or exported in the dependency */
    specifiers: string[] | null;
    /** Relationship between the elements from both perspectives */
    relationship: {
        /** Relationship between the elements from the perspective of the file */
        from: DependencyRelationship | null;
        /** Relationship between the elements from the perspective of the dependency */
        to: DependencyRelationship | null;
    };
};
/**
 * Description of a dependency between two elements
 */
type DependencyDescription = {
    /** Source element of the dependency */
    from: FileElement;
    /** Target element of the dependency */
    to: DependencyElementDescription;
    /** Information about the dependency */
    dependency: ElementsDependencyInfo;
};
/**
 * Serialized cache of dependencies descriptor.
 */
type DependenciesDescriptorSerializedCache = Record<string, DependencyDescription>;
/** Options for describing a dependency between two elements */
type DescribeDependencyOptions = {
    /** Path of the element where the dependency originates */
    from: string;
    /** Path of the element where the dependency points to */
    to?: string;
    /** Source of the dependency (import/export path) */
    source: string;
    /** Kind of the dependency (type, runtime) */
    kind: DependencyKind;
    /** Type of the node creating the dependency in the dependent element */
    nodeKind?: string;
    /** Specifiers imported or exported in the dependency */
    specifiers?: string[];
};

/**
 * Determines if the value is a valid dependency kind.
 * @param value The value to check
 * @returns True if the value is a valid dependency kind, false otherwise.
 */
declare function isDependencyKind(value: unknown): value is DependencyKind;
/**
 * Determines if the given value is a valid dependency relationship.
 * @param value The value to check.
 * @returns True if the value is a valid dependency relationship, false otherwise.
 */
declare function isDependencyRelationship(value: unknown): value is DependencyRelationship;
/**
 * Determines if the given value is a valid dependency relationship description.
 * @param value The value to check.
 * @returns True if the value is a valid dependency relationship, false otherwise.
 */
declare function isDependencyRelationshipDescription(value: unknown): value is DependencyRelationship;
/**
 * Returns whether the given value is a valid ElementsDependencyInfo object.
 * @param value The value to check.
 * @returns True if the value is a valid ElementsDependencyInfo object, false otherwise.
 */
declare function isElementsDependencyInfo(value: unknown): value is ElementsDependencyInfo;
/**
 * Determines whether the given value is a valid DependencyDescription object.
 * @param value The value to check
 * @returns True if the value is a valid DependencyDescription object, false otherwise.
 */
declare function isDependencyDescription(value: unknown): value is DependencyDescription;
/**
 * Determines whether the given dependency description is internal.
 * @param dependency The dependency to check
 * @returns True if the dependency is internal, false otherwise
 */
declare function isInternalDependency(dependency: DependencyDescription): boolean;

/**
 * Serialized cache for Descriptors class.
 */
type DescriptorsSerializedCache = {
    /** Serialized elements cache */
    elements: ElementsDescriptorSerializedCache;
    /** Serialized dependencies cache */
    dependencies: DependenciesDescriptorSerializedCache;
};

/**
 * Result of matching an element selector against an element.
 */
type DependencyMatchResult = {
    /** The selector matching result for the 'from' element. */
    from: ElementSelectorData | null;
    /** The selector matching result for the 'to' element. */
    to: ElementSelectorData | null;
    /** Whether the dependency matches all the selector properties provided */
    isMatch: boolean;
};
/**
 * Serialized cache of elements matcher.
 */
type ElementsMatcherSerializedCache = Record<string, ElementSelectorData | null>;
/**
 * Serialized cache of dependencies matcher.
 */
type DependenciesMatcherSerializedCache = Record<string, DependencyMatchResult>;
/**
 * Serialized cache of matcher descriptors.
 */
type MatcherSerializedCache = {
    descriptors: DescriptorsSerializedCache;
};
/**
 * Serialized cache of micromatch matcher.
 */
type MicromatchSerializedCache = {
    matchingResults: Record<string, boolean>;
    captures: Record<string, string[] | null>;
};
/**
 * Elements that can return a match when using an element selector.
 */
type SelectableElement = IgnoredElement | LocalElementKnown | LocalElementUnknown | CoreDependencyElement | ExternalDependencyElement | LocalDependencyElementKnown;
/**
 * Selector for matching captured values in element selectors.
 * It is a record where the keys are the names of the captured values and the values are the patterns to match on those captured values.
 */
type CapturedValuesSelector = Record<string, MicromatchPattern>;
/**
 * Data to pass to selector templates when they are rendered before matching.
 */
type TemplateData = Record<string, unknown>;
/**
 * Options for elements and dependencies matchers.
 */
type MatcherOptionsDependencySelectorsGlobals = {
    /** The kind of the dependency */
    kind?: MicromatchPattern;
};
/**
 * Options for elements and dependencies matchers.
 */
type MatcherOptions = {
    /** Extra data to pass to captured values templates. By default, data from the element and dependency being matched is passed as to/from. */
    extraTemplateData?: TemplateData;
    /**
     * Properties to add to all dependency selectors used in the matcher. Added for backwards compatibility, because eslint-plugin rules defined importKind at the top level of the rule options.
     * @deprecated Use 'kind' property directly in the dependency element selectors instead.
     **/
    dependencySelectorsGlobals?: MatcherOptionsDependencySelectorsGlobals;
};
/**
 * Simple element selector by type, represented as a string matching the element type.
 * @deprecated Use BaseElementSelectorData or DependencyElementSelectorData instead.
 */
type SimpleElementSelectorByType = string;
/**
 * Selector for base elements, including captured values for dynamic matching.
 */
type BaseElementSelectorData = {
    /** Micromatch pattern(s) to match the path of the element */
    path?: MicromatchPattern;
    /** Micromatch pattern(s) to match the path of the element containing the file */
    elementPath?: MicromatchPattern;
    /** Micromatch pattern(s) to match internal paths within the file or dependency, relative to the element path */
    internalPath?: MicromatchPattern;
    /** Type of the element */
    type?: MicromatchPattern;
    /** Category of the element */
    category?: MicromatchPattern;
    /** Captured values selector for dynamic matching */
    captured?: CapturedValuesSelector;
    /** Origin of the element */
    origin?: MicromatchPattern;
    /** Micromatch pattern(s) to match the source of the dependency */
    source?: MicromatchPattern;
    /** Base source of the element, e.g., the import path of a dependency */
    baseSource?: MicromatchPattern;
    /** Whether the element is ignored */
    isIgnored?: boolean;
    /** Whether the element is unknown */
    isUnknown?: boolean;
};
/**
 * Selector for dependency elements, including kind, specifier, and node kind filters.
 */
type DependencyElementSelectorData = BaseElementSelectorData & {
    /** Relationship of the file element with the dependency declared in it */
    relationship?: MicromatchPattern;
    /** Dependency kind to filter elements */
    kind?: MicromatchPattern;
    /** Micromatch pattern(s) to match only specific imports/exports */
    specifiers?: MicromatchPattern;
    /** Node kind to filter elements */
    nodeKind?: MicromatchPattern;
};
/**
 * File Element selector with options, including captured values for dynamic matching.
 * It is represented as a tuple where the first element is the element type (string)
 * and the second element is an object containing a selector for captured values.
 * @deprecated Use FileElementSelectorData defining an object with type and/or category and the rest of properties directly instead.
 */
type BaseElementSelectorWithOptions = [
    SimpleElementSelectorByType,
    CapturedValuesSelector
];
/**
 * Dependency Element selector with options, including captured values for dynamic matching.
 * It is represented as a tuple where the first element is the element type (string)
 * and the second element is an object containing a selector for captured values.
 * @deprecated Use DependencyElementSelectorData defining an object with type and/or category and the rest of properties directly instead.
 */
type DependencyElementSelectorWithOptions = [
    SimpleElementSelectorByType,
    CapturedValuesSelector
];
/**
 * Base Element selector, which can be a simple string, object with type and/or category, or a base element selector with options.
 */
type BaseElementSelector = SimpleElementSelectorByType | BaseElementSelectorData | BaseElementSelectorWithOptions;
/**
 * Dependency Element selector, which can be a simple string, object with type and/or category, or a dependency element selector with options.
 */
type DependencyElementSelector = SimpleElementSelectorByType | DependencyElementSelectorData | DependencyElementSelectorWithOptions;
/** Base elements selector, which can be a single base element selector or an array of base element selectors. */
type BaseElementsSelector = BaseElementSelector | BaseElementSelector[];
/** Dependency elements selector, which can be a single dependency element selector or an array of dependency element selectors. */
type DependencyElementsSelector = DependencyElementSelector | DependencyElementSelector[];
/**
 * Element selector data, which may be a base element selector or a dependency element selector.
 */
type ElementSelectorData = BaseElementSelectorData | DependencyElementSelectorData;
/**
 * Generic Element selector with options, including captured values for dynamic matching.
 * It is represented as a tuple where the first element is the element type (string)
 * and the second element is an object containing a selector for captured values.
 * @deprecated Use ElementSelector defining an object with type and/or category and the rest of properties directly instead.
 */
type ElementSelectorWithOptions = [
    SimpleElementSelectorByType,
    CapturedValuesSelector
];
/**
 * Element selector, which can be a simple string, object with type and/or category, or an element selector with options.
 */
type ElementSelector = SimpleElementSelectorByType | ElementSelectorData | ElementSelectorWithOptions;
/**
 * Elements selector, which can be a single element selector or an array of element selectors.
 */
type ElementsSelector = BaseElementsSelector | DependencyElementsSelector;
/**
 * Element selectors, which can be a single element selector or an array of element selectors.
 * @deprecated Use ElementsSelector instead.
 */
type ElementSelectors = ElementsSelector;
/**
 * Dependency selector, which includes optional 'from' and 'to' elements selectors.
 */
type DependencySelector = {
    /** Selector for the dependant elements. The file originating the dependency */
    from?: BaseElementsSelector;
    /** Selector for the dependency elements. The element being imported/exported */
    to?: DependencyElementsSelector;
};
/**
 * Normalized dependency selector, where 'from' and 'to' are always arrays or null.
 */
type DependencySelectorNormalized = {
    /** Selector for the dependant elements. The file originating the dependency */
    from: BaseElementSelectorData[] | null;
    /** Selector for the dependency elements. The element being imported/exported */
    to: DependencyElementSelectorData[] | null;
};
/**
 * Options for selecting external libraries, including path patterns and optional specifiers.
 * If specifiers are provided, they will be used to match specific imports from the external library.
 */
type ExternalLibrarySelectorOptions = {
    /**
     * Micromatch pattern(s) to match only one or more specific subpaths of the external library.
     */
    path?: MicromatchPattern;
    /** Micromatch pattern(s) to match only specific imports/exports */
    specifiers?: string[];
};
/**
 * External library selector with options, represented as a tuple where the first element is the import path of the external library, and the second element is an object containing options for selecting only specific paths or specifiers from that library.
 */
type ExternalLibrarySelectorWithOptions = [
    SimpleElementSelectorByType,
    ExternalLibrarySelectorOptions
];
/**
 * External library selector, which can be a simple string (the import path) or an external library selector with options.
 */
type ExternalLibrarySelector = SimpleElementSelectorByType | ExternalLibrarySelectorWithOptions;
/**
 * External library selectors, which can be a single external library selector or an array of external library selectors.
 * @deprecated Use ExternalLibrariesSelector instead.
 */
type ExternalLibrarySelectors = ExternalLibrariesSelector;
/**
 * External libraries selector, which can be a single external library selector or an array of external library selectors.
 */
type ExternalLibrariesSelector = ExternalLibrarySelector | ExternalLibrarySelector[];

/**
 * Micromatch wrapper class with caching capabilities.
 */
declare class Micromatch {
    /**
     * Cache for micromatch matching results
     */
    private readonly _matchingResultsCache;
    /**
     * Cache for micromatch captures
     */
    private readonly _capturesCache;
    /**
     * Cache for micromatch makeRe results
     */
    private readonly _makeReCache;
    /**
     * Creates an instance of Micromatch class.
     * @param cache Whether to use caching or not.
     */
    constructor(cache: boolean);
    /**
     * Clears all caches.
     */
    clearCache(): void;
    /**
     * Serializes the current cache state.
     * @returns The serialized cache data.
     */
    serializeCache(): MicromatchSerializedCache;
    /**
     * Restores the cache state from serialized data.
     * @param serializedCache The serialized cache data.
     */
    setFromSerialized(serializedCache: MicromatchSerializedCache): void;
    /**
     * Optimized micromatch match with caching.
     * @param value The value to match.
     * @param pattern The pattern to match against.
     * @returns True if the value matches the pattern, false otherwise.
     */
    isMatch(value: string, pattern: string | string[]): boolean;
    /**
     * Optimized micromatch capture with caching.
     * @param pattern The pattern to match against.
     * @param target The target string to test.
     * @returns Captured groups or null if no match.
     */
    capture(pattern: string, target: string): string[] | null;
    /**
     * Optimized micromatch makeRe with caching.
     * @param pattern The pattern to convert to RegExp.
     * @returns The RegExp instance.
     */
    makeRe(pattern: string): RegExp;
}

/**
 * Normalizes an ElementsSelector into an array of ElementSelectorData.
 * @param elementsSelector The elements selector, in any supported format.
 * @returns The normalized array of selector data.
 */
declare function normalizeElementsSelector(elementsSelector: BaseElementsSelector): BaseElementSelectorData[];
declare function normalizeElementsSelector(elementsSelector: DependencyElementsSelector): DependencyElementSelectorData[];
/**
 * Base matcher class to determine if elements or dependencies match a given selector.
 */
declare class BaseElementsMatcher {
    /**
     * Option to use legacy templates with ${} syntax.
     */
    protected readonly _legacyTemplates: boolean;
    /**
     * Micromatch instance for matching.
     */
    protected micromatch: Micromatch;
    /**
     * Creates a new BaseElementsMatcher.
     * @param config Configuration options for the matcher.
     * @param globalCache Global cache instance.
     */
    constructor(config: MatchersOptionsNormalized, micromatch: Micromatch);
    /**
     * Converts a template with ${} to Handlebars {{}} templates for backwards compatibility.
     * @param template The template to convert.
     * @returns The converted template.
     */
    private _getBackwardsCompatibleTemplate;
    /**
     * Determines if a template contains Handlebars syntax.
     * @param template The template to check.
     * @returns True if the template contains Handlebars syntax, false otherwise.
     */
    private _isHandlebarsTemplate;
    /**
     * Returns a rendered template using the provided template data.
     * Optimized version with template caching for better performance.
     * @param template The template to render.
     * @param templateData The data to use for replace in the template.
     * @returns The rendered template.
     */
    private _getRenderedTemplate;
    /**
     * Returns rendered templates using the provided template data.
     * @param template The templates to render.
     * @param extraTemplateData The data to use for replace in the templates.
     * @returns The rendered templates.
     */
    protected getRenderedTemplates(template: MicromatchPattern, templateData: TemplateData): MicromatchPattern;
    /**
     * Returns whether the given value matches the micromatch pattern, converting non-string values to strings.
     * Optimized version with caching for better performance.
     * @param value The value to check.
     * @param pattern The micromatch pattern to match against.
     * @returns Whether the value matches the pattern.
     */
    protected isMicromatchMatch(value: unknown, pattern: MicromatchPattern): boolean;
    /**
     * Returns whether the given value matches the micromatch pattern after rendering it as a template.
     * @param pattern The micromatch pattern to render and match against.
     * @param templateData The data to use for rendering the pattern as a template.
     * @param value The value to check.
     * @returns Whether the value matches the rendered pattern.
     */
    protected isTemplateMicromatchMatch(pattern: MicromatchPattern, templateData: TemplateData, value?: unknown): boolean;
    /**
     * Whether the given element key matches the selector key as booleans.
     * @param param0 The parameters object.
     * @returns Whether the element key matches the selector key.
     */
    protected isElementKeyBooleanMatch<T extends BaseElement, S extends BaseElementSelectorData>({ 
    /** The element to check. */
    element, 
    /** The selector to check against. */
    selector, 
    /** The key of the element to check. */
    elementKey, 
    /** The key of the selector to check against. */
    selectorKey, }: {
        /** The element to check. */
        element: T;
        /** The selector to check against. */
        selector: S;
        /** The key of the element to check. */
        elementKey: keyof T;
        /** The key of the selector to check against. */
        selectorKey: keyof S;
    }): boolean;
    /**
     * Whether the given element key matches the selector key using micromatch.
     * @param param0 The parameters object.
     * @returns Whether the element key matches the selector key.
     */
    protected isElementKeyMicromatchMatch<T extends SelectableElement, S extends BaseElementSelectorData | DependencyElementSelectorData>({ element, selector, elementKey, selectorKey, selectorValue, templateData, }: {
        /** The element to check. */
        element: T;
        /** The selector to check against. */
        selector: S;
        /** The key of the element to check. */
        elementKey: T extends LocalElementKnown ? keyof LocalElementKnown : T extends CoreDependencyElement ? keyof CoreDependencyElement : T extends ExternalDependencyElement ? keyof ExternalDependencyElement : T extends IgnoredElement ? keyof IgnoredElement : keyof LocalDependencyElementKnown;
        /** The key of the selector to check against. */
        selectorKey: S extends DependencyElementSelectorData ? keyof DependencyElementSelectorData : keyof BaseElementSelectorData;
        /** The value of the selector key to check against. */
        selectorValue?: MicromatchPattern;
        /** Data to pass when the selector value is rendered as a template */
        templateData: TemplateData;
    }): boolean;
}

/**
 * Matcher class to determine if elements match a given selector.
 */
declare class ElementsMatcher extends BaseElementsMatcher {
    /** Whether the cache is enabled or not */
    private readonly _cacheIsEnabled;
    /**
     * Creates a new ElementsSelectorMatcher.
     * @param config Configuration options for the matcher.
     * @param micromatch Micromatch instance for matching.
     * @param globalCache Global cache instance.
     */
    constructor(config: MatchersOptionsNormalized, micromatch: Micromatch);
    /**
     * Whether the given element type matches the selector type.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element type matches the selector type.
     */
    private _isTypeMatch;
    /**
     * Whether the given element category matches the selector category.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element category matches the selector category.
     */
    private _isCategoryMatch;
    /**
     * Whether the given element path matches the selector path.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element path matches the selector path.
     */
    private _isPathMatch;
    /**
     * Whether the given element path matches the selector element path.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element path matches the selector element path.
     */
    private _isElementPathMatch;
    /**
     * Whether the given element internal path matches the selector internal path.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element internal path matches the selector internal path.
     */
    private _isInternalPathMatch;
    /**
     * Whether the given element origin matches the selector origin
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element origin matches the selector origin.
     */
    private _isOriginMatch;
    /**
     * Whether the given element baseSource matches the selector baseSource
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element baseSource matches the selector baseSource.
     */
    private _isBaseSourceMatch;
    /**
     * Whether the given element source matches the selector source
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param templateData The data to use for replace in selector value
     * @returns Whether the element source matches the selector source.
     */
    private _isSourceMatch;
    /**
     * Determines if the captured values of the element match those in the selector.
     * @param element The element to check.
     * @param selector The selector to check against
     * @param templateData The data to use for replace in selector values
     * @returns True if the captured values match, false otherwise.
     */
    private _isCapturedValuesMatch;
    /**
     * Determines if the isIgnored property of the element matches that in the selector.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @returns True if the isIgnored properties match, false otherwise.
     */
    private _isIgnoredMatch;
    /**
     * Determines if the isUnknown property of the element matches that in the selector.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @returns True if the isUnknown properties match, false otherwise.
     */
    private _isUnknownMatch;
    /**
     * Returns the selector matching result for the given local or external element.
     * @param element The local or external element to check.
     * @param selector The selector to check against.
     * @param extraTemplateData Extra template data to use for matching.
     * @returns The selector matching result for the given element, or null if none matches.
     */
    private _getSelectorMatching;
    /**
     * Returns the selector matching result for the given element, or null if none matches.
     * It omits checks in keys applying only to dependency between elements, such as relationship.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param options Extra options for matching, such as templates data, globals for dependency selectors, etc.
     * @returns The selector matching result for the given element, or null if none matches.
     */
    getSelectorMatching(element: ElementDescription, selector: BaseElementsSelector, { extraTemplateData }?: MatcherOptions): ElementSelectorData | null;
    /**
     * Returns whether the given element matches the selector.
     * It omits checks in keys applying only to dependency between elements, such as relationship.
     * @param element The element to check.
     * @param selector The selector to check against.
     * @param options Extra options for matching, such as templates data, globals for dependency selectors, etc.
     * @returns Whether the element matches the selector properties applying to elements.
     */
    isElementMatch(element: ElementDescription, selector: BaseElementsSelector, options?: MatcherOptions): boolean;
}

/**
 * Matcher class to determine if dependencies match a given dependencies selector.
 */
declare class DependenciesMatcher extends BaseElementsMatcher {
    /**
     * Elements matcher to use for matching elements within dependencies.
     */
    private readonly _elementsMatcher;
    /**
     * Creates a new DependenciesMatcher.
     * @param elementsMatcher Elements matcher to use for matching elements within dependencies.
     * @param config Configuration options for the matcher.
     * @param micromatch Micromatch instance for matching.
     * @param globalCache Global cache instance.
     */
    constructor(elementsMatcher: ElementsMatcher, config: MatchersOptionsNormalized, micromatch: Micromatch);
    /**
     * Normalizes selector into DependencySelectorNormalized format, containing arrays of selectors data.
     * @param selector The dependency selector to normalize.
     * @returns The normalized dependency selector.
     */
    private _normalizeDependencySelector;
    /**
     * Converts a DependencyElementSelectorData to a BaseElementSelectorData, by removing dependency-specific properties.
     * @param selector The dependency element selector data.
     * @returns The base element selector data.
     */
    private _convertDependencyElementSelectorDataToBaseElementSelectorData;
    /**
     * Returns the selectors matching result for the given dependency.
     * @param dependency The dependency description.
     * @param selector The dependency selector normalized.
     * @param extraTemplateData The extra template data for selector values.
     * @returns The selectors matching result for the given dependency.
     */
    private _getSelectorMatching;
    /**
     * Determines if the dependency relationship matches the selector.
     * @param dependency The dependency description.
     * @param selector The data of an element selector.
     * @returns Whether the dependency relationship matches the selector.
     */
    private _relationshipMatches;
    /**
     * Determines if the selector matches an specific kind
     * @param selector The dependency selector data
     * @param kind Kind to check
     * @param templateData The template data for rendering selector values
     * @returns Whether the selector matches the kind
     */
    private _kindMatches;
    /**
     * Determines if the selector matches some of the specifiers
     * @param selector The dependency selector data
     * @param specifiers Specifiers to check
     * @param templateData The template data for rendering selector values
     * @returns Whether the selector matches some of the specifiers
     */
    private _specifierMatches;
    /**
     * Determines if the selector matches the nodeKind
     * @param selector The dependency selector data
     * @param nodeKind The nodeKind to check
     * @param templateData The template data for rendering selector values
     * @returns Whether the selector matches the nodeKind
     */
    private _nodeKindMatches;
    /**
     * Determines if the dependency description matches the selector for 'from'.
     * @param dependency The dependency description.
     * @param fromSelector The selector for 'from' elements.
     * @param templateData The template data for rendering selector values
     * @returns Whether the dependency properties match the selector for 'from'.
     */
    private _dependencyFromPropertiesMatch;
    /**
     * Determines if the dependency description matches the selector for 'to'.
     * @param dependency The dependency description.
     * @param toSelector The selector for 'to' elements.
     * @param templateData The template data for rendering selector values
     * @returns Whether the dependency properties match the selector for 'to'.
     */
    private _dependencyToPropertiesMatch;
    /**
     * Returns the selectors matching result for the given dependency.
     * @param dependency The dependency to check.
     * @param selector The selector to check against.
     * @param options Extra options for matching, such as templates data, globals for dependency selectors, etc.
     * @returns The matching result for the dependency against the selector.
     */
    getSelectorsMatching(dependency: DependencyDescription, selector: DependencySelector, { extraTemplateData, dependencySelectorsGlobals, }?: MatcherOptions): DependencyMatchResult;
    /**
     * Returns whether the given dependency matches the selector.
     * @param dependency The dependency to check.
     * @param selector The selector to check against.
     * @param options Extra options for matching, such as templates data, globals for dependency selectors, etc.
     * @returns Whether the dependency matches the selector properties.
     */
    isDependencyMatch(dependency: DependencyDescription, selector: DependencySelector, options?: MatcherOptions): boolean;
}

/**
 * Determines if the given value is a captured values selector.
 * @param value The value to check.
 * @returns True if the value is a captured values selector, false otherwise.
 */
declare function isCapturedValuesSelector(value: unknown): value is CapturedValuesSelector;
/**
 * Determines if the given value is a simple element selector.
 * @param value The value to check.
 * @returns True if the value is a simple element selector, false otherwise.
 */
declare function isSimpleElementSelectorByType(value: unknown): value is SimpleElementSelectorByType;
/**
 * Determines if the given selector is a base element selector.
 * @param value The value to check.
 * @returns True if the selector is a base element selector
 */
declare function isBaseElementSelectorData(value: unknown): value is ElementSelectorData;
/**
 * Determines if the given selector is an element or dependency element selector data.
 * @param value The value to check.
 * @returns True if the selector is an element or dependency element selector data, false otherwise.
 */
declare function isElementSelectorData(value: unknown): value is ElementSelectorData;
/**
 * Determines if the given selector is an element selector with options.
 * @param value The value to check.
 * @returns True if the selector is an element selector with options, false otherwise.
 */
declare function isElementSelectorWithLegacyOptions(value: unknown): value is ElementSelectorWithOptions;
/**
 * Determines if the given value is an element selector.
 * @param value The value to check.
 * @returns True if the value is an element selector, false otherwise.
 */
declare function isElementSelector(value: unknown): value is ElementSelector;
/**
 * Determines if the given value is an elements selector.
 * @param value The value to check.
 * @returns True if the value is an elements selector, false otherwise.
 */
declare function isElementsSelector(value: unknown): value is ElementSelectors;
/**
 * Determines if the given value is a dependency selector.
 * @param value The value to check
 * @returns True if the value is a dependency selector, false otherwise.
 */
declare function isDependencySelector(value: unknown): value is DependencySelector;
/**
 * Determines if the given value is external library selector options with a path.
 * @param value The value to check.
 * @returns True if the value is external library selector options with a path, false otherwise.
 */
declare function isExternalLibrarySelectorOptionsWithPath(value: unknown): value is ExternalLibrarySelectorOptions & {
    path: string | string[];
};
/**
 * Determines if the given value is external library selector options with specifiers.
 * @param value The value to check.
 * @returns True if the value is external library selector options with specifiers, false otherwise.
 */
declare function isExternalLibrarySelectorOptionsWithSpecifiers(value: unknown): value is ExternalLibrarySelectorOptions & {
    specifiers: string[];
};
/**
 * Determines if the given value is external library selector options.
 * @param value The value to check.
 * @returns True if the value is external library selector options, false otherwise.
 */
declare function isExternalLibrarySelectorOptions(value: unknown): value is ExternalLibrarySelectorOptions;
/**
 * Determines if the given value is an external library selector with options.
 * @param value The value to check.
 * @returns True if the value is an external library selector with options, false otherwise.
 */
declare function isExternalLibrarySelectorWithOptions(value: unknown): value is ExternalLibrarySelectorWithOptions;
/**
 * Determines if the given value is an external library selector.
 * @param value The value to check.
 * @returns True if the value is an external library selector, false otherwise.
 */
declare function isExternalLibrarySelector(value: unknown): value is ExternalLibrarySelector;
/**
 * Determines if the given value is an external libraries selector.
 * @param value The value to check.
 * @returns True if the value is an external libraries selector, false otherwise.
 */
declare function isExternalLibrariesSelector(value: unknown): value is ExternalLibrariesSelector;

/**
 * Matcher class to evaluate if elements or dependencies match given selectors.
 */
declare class Matcher {
    private readonly _descriptors;
    private readonly _elementsMatcher;
    private readonly _dependenciesMatcher;
    /**
     * Constructor for the Matcher class.
     * @param descriptors Element descriptors to use for matching.
     * @param elementsMatcher Elements matcher instance.
     * @param dependenciesMatcher Dependencies matcher instance.
     * @param config Configuration options.
     * @param globalCache Global cache instance.
     */
    constructor(descriptors: ElementDescriptors, elementsMatcher: ElementsMatcher, dependenciesMatcher: DependenciesMatcher, config: DescriptorOptionsNormalized, micromatch: Micromatch);
    /**
     * Determines if an element matches a given selector.
     * @param filePath The file path of the element
     * @param selector The selector to match against
     * @param options Extra matcher options
     * @returns True if the element matches the selector, false otherwise
     */
    private _isElementMatch;
    /**
     * Determines if a dependency matches a given selector.
     * @param dependencyData The data describing the dependency
     * @param selector The selector to match against
     * @param options Extra matcher options
     * @returns True if the dependency matches the selector, false otherwise
     */
    private _isDependencyMatch;
    /**
     * Determines if the given element or dependency matches the provided selector.
     * @param descriptorOptions The file path or dependency options to describe the element or dependency
     * @param selector The selector to match against
     * @param options Extra matcher options
     */
    isMatch(descriptorOptions: string, selector: ElementsSelector, options?: MatcherOptions): boolean;
    isMatch(descriptorOptions: DescribeDependencyOptions, selector: DependencySelector, options?: MatcherOptions): boolean;
    /**
     * Determines the selector matching for an element.
     * @param filePath The file path of the element
     * @param selector The selectors to match against
     * @param options Extra options for matching
     * @returns The matching selector data or null if no match is found
     */
    private _getElementSelectorMatching;
    /**
     * Determines the selector matching for a dependency.
     * @param dependencyData The data describing the dependency
     * @param selector The selectors to match against
     * @param options Extra options for matching
     * @returns The matching dependency result or null if no match is found
     */
    private _getDependencySelectorMatching;
    /**
     * Determines the selector matching for a dependency or element.
     * @param descriptorOptions The file path or dependency options to describe the element or dependency
     * @param selector The selectors to match against
     * @param options Extra options for matching
     * @returns The matching dependency result or element selector data, or null if no match is found
     */
    getSelectorMatching(descriptorOptions: string, selector: ElementsSelector, options?: MatcherOptions): ElementSelectorData | null;
    getSelectorMatching(descriptorOptions: DescribeDependencyOptions, selector: DependencySelector, options?: MatcherOptions): DependencyMatchResult | null;
    /**
     * Returns the selectors matching result for the given element or dependency description.
     * @param description The element or dependency  description to check.
     * @param selector The selector to check against.
     * @param options Extra options for matching, such as templates data, globals for dependency selectors, etc.
     * @returns The selectors matching result for the given description, and whether it matches or not.
     */
    getSelectorMatchingDescription(description: DependencyDescription, selector: DependencySelector, options?: MatcherOptions): DependencyMatchResult;
    getSelectorMatchingDescription(description: ElementDescription, selector: ElementsSelector, options?: MatcherOptions): ElementSelectorData;
    /**
     * Describes an element given its file path.
     * @param filePath The path of the file to describe.
     * @returns The description of the element.
     */
    describeElement(filePath: string): FileElement;
    /**
     * Describes a dependency element given its dependency source and file path.
     * @param dependencySource The source of the dependency.
     * @param filePath The path of the file being the dependency, if known.
     * @returns The description of the dependency element.
     */
    describeDependencyElement(dependencySource: string, filePath?: string): DependencyElementDescription;
    /**
     * Describes elements in a dependency relationship, and provides additional information about the dependency itself.
     * @param options The options for describing the elements and the dependency details.
     * @returns The description of the dependency between the elements.
     */
    describeDependency(options: DescribeDependencyOptions): DependencyDescription;
    /**
     * Clears all caches.
     */
    clearCache(): void;
    /**
     * Serializes the descriptors matchers cache to a plain object.
     * @returns The serialized cache
     */
    serializeCache(): MatcherSerializedCache;
    /**
     * Sets the descriptors matchers cache from a serialized object.
     * @param serializedCache The serialized cache
     */
    setCacheFromSerialized(serializedCache: {
        descriptors: ReturnType<Descriptors["serializeCache"]>;
    }): void;
}

/**
 * Class with methods to describe elements and dependencies between them.
 */
declare class Descriptors {
    private readonly _elementsDescriptor;
    private readonly _dependenciesDescriptor;
    /** Creates a new DescriptorsManager instance
     * @param elementDescriptors The element descriptors.
     * @param configOptions The configuration options.
     * @param micromatch The Micromatch instance.
     */
    constructor(elementDescriptors: ElementDescriptors, config: DescriptorOptionsNormalized, micromatch: Micromatch);
    /**
     * Serializes the elements and dependencies cache to a plain object.
     * @returns The serialized elements and dependencies cache.
     */
    serializeCache(): DescriptorsSerializedCache;
    /**
     * Sets the elements and dependencies cache from a serialized object.
     * @param serializedCache The serialized elements and dependencies cache.
     */
    setCacheFromSerialized(serializedCache: DescriptorsSerializedCache): void;
    /**
     * Clears all caches.
     */
    clearCache(): void;
    /**
     * Describes an element given its file path.
     * @param filePath The path of the file to describe.
     * @returns The description of the element.
     */
    describeElement(filePath?: string): FileElement;
    /**
     * Describes a dependency element given its dependency source and file path.
     * @param dependencySource The source of the dependency.
     * @param filePath The path of the file being the dependency, if known.
     * @returns The description of the dependency element.
     */
    describeDependencyElement(dependencySource: string, filePath?: string): DependencyElementDescription;
    /**
     * Describes elements in a dependency relationship, and provides additional information about the dependency itself.
     * @param options The options for describing the elements and the dependency details.
     * @returns The description of the dependency between the elements.
     */
    describeDependency(options: DescribeDependencyOptions): DependencyDescription;
}

/**
 * Serialized cache for Elements class.
 */
type ElementsSerializedCache = {
    /** Cache for Matcher instances per configuration */
    matchers: Record<string, {
        config: ConfigOptionsNormalized;
        elementDescriptors: ElementDescriptors;
        cache: MatcherSerializedCache;
    }>;
    micromatch: MicromatchSerializedCache;
};

/**
 * Main class to interact with Elements functionality.
 * It include one method to get descriptors with different caching for different configurations, methods to manage the cache, and methods to match element selectors against element descriptions.
 */
declare class Elements {
    /** The global configuration options for Elements. Can be overridden when getting a descriptor */
    private readonly _globalConfigOptions;
    /** Cache manager for Matcher instances, unique for each different configuration */
    private readonly _matchersCache;
    /** Micromatch instances for pattern matching */
    private readonly _micromatchWithCache;
    private readonly _micromatchWithoutCache;
    /**
     * Creates a new Elements instance
     * @param configOptions The global configuration options for Elements. Can be overridden when getting a descriptor.
     */
    constructor(configOptions?: ConfigOptions);
    /**
     * Returns a serialized representation of the current state of the cache.
     * @returns A serialized representation of the cache.
     */
    serializeCache(): ElementsSerializedCache;
    /**
     * Sets the Elements cache from a serialized representation.
     * @param serializedCache The serialized cache to set.
     */
    setCacheFromSerialized(serializedCache: ElementsSerializedCache): void;
    /**
     * Clears cache
     */
    clearCache(): void;
    /**
     * Gets a Matcher instance for the given configuration options.
     * It uses caching to return the same instance for the same configuration options. If no options are provided, the global configuration options are used.
     * @param elementDescriptors The element descriptors to use.
     * @param config Optional configuration options to override the global ones.
     * @returns A matcher instance, unique for each different configuration.
     */
    getMatcher(elementDescriptors: ElementDescriptors, config?: ConfigOptions): Matcher;
}

/**
 * Class describing elements in a project given their paths and configuration.
 */
declare class ElementsDescriptor {
    private _mod;
    /**
     * Cache to store previously described elements.
     */
    private readonly _descriptionsCache;
    /**
     * Cache to store previously described files.
     */
    private readonly _filesCache;
    /**
     * Configuration instance for this descriptor.
     */
    private readonly _config;
    /**
     * Element descriptors used by this descriptor.
     */
    private readonly _elementDescriptors;
    /** Micromatch instance for path matching */
    private readonly _micromatch;
    /**
     * The configuration options for this descriptor.
     * @param elementDescriptors The element descriptors.
     * @param configOptions The configuration options.
     * @param globalCache The global cache for various caching needs.
     * @param micromatch The micromatch instance for path matching.
     */
    constructor(elementDescriptors: ElementDescriptors, configOptions: DescriptorOptionsNormalized, micromatch: Micromatch);
    /**
     * Serializes the elements cache to a plain object.
     * @returns The serialized elements cache.
     */
    serializeCache(): ElementsDescriptorSerializedCache;
    /**
     * Sets the elements cache from a serialized object.
     * @param serializedCache The serialized elements cache.
     */
    setCacheFromSerialized(serializedCache: ElementsDescriptorSerializedCache): void;
    /**
     * Clears the elements cache.
     */
    clearCache(): void;
    /**
     * Loads the Node.js module to access built-in modules information when running in Node.js environment.
     */
    private _loadModuleInNode;
    /**
     * Validates the element descriptors to ensure they are correctly defined.
     */
    private _validateDescriptors;
    /**
     * Determines if a dependency source is a core module.
     * @param dependencySource The source of the dependency to check.
     * @param baseDependencySource The base source of the dependency to check.
     * @returns True if the dependency source is a core module, false otherwise.
     */
    private _dependencySourceIsCoreModule;
    /**
     * Determines if a dependency source is scoped (e.g., @scope/package).
     * @param dependencySource The source of the dependency to check.
     * @returns True if the dependency source is scoped, false otherwise.
     */
    private _dependencySourceIsScoped;
    /**
     * Determines if a dependency source is external or an alias.
     * @param dependencySource The source of the dependency to check.
     * @returns True if the dependency source is external or an alias, false otherwise.
     */
    private _dependencySourceIsExternalOrScoped;
    /**
     * Gets the base source of an external module.
     * @param dependencySource The source of the dependency to check.
     * @returns The base source of the external module. (e.g., for "@scope/package/submodule", it returns "@scope/package")
     */
    private _getExternalOrCoreModuleBaseSource;
    /**
     * Determines if a file path is outside the configured root path.
     * @param filePath The file path to check.
     * @returns True if the file path is outside the root path, false otherwise.
     */
    private _isOutsideRootPath;
    /**
     * Converts an absolute file path to a relative path if rootPath is configured.
     * If rootPath is not configured, returns the path as-is (maintains backward compatibility).
     * @param filePath The file path to convert (can be absolute or relative)
     * @returns The relative path if rootPath is configured and path is absolute, otherwise the original path
     */
    private _toRelativePath;
    /**
     * Checks if a source string matches any of the provided patterns using micromatch.
     * @param patterns - Array of micromatch patterns
     * @param source - The source string to match against patterns
     * @returns True if the source matches any pattern, false otherwise
     */
    private _matchesAnyPattern;
    /**
     * Determines if an element is external based on its file path and dependency source.
     * Uses the flagAsExternal configuration to evaluate multiple conditions with OR logic:
     * - unresolvableAlias: Files whose path cannot be resolved (filePath is null)
     * - inNodeModules: Non-relative paths that include "node_modules"
     * - outsideRootPath: Resolved path is outside the configured root path (only if rootPath is configured)
     * - customSourcePatterns: Source matches any of the configured patterns
     * @param filePath The resolved file path (null if unresolved). Can be absolute if rootPath is configured, or relative if rootPath is not configured.
     * @param isOutsideRootPath Whether the file path is outside the configured root path.
     * @param dependencySource The import/export source string
     * @returns True if any of the configured conditions is met, false otherwise
     */
    private _isExternalDependency;
    /**
     * Determines if a given path is included based on the configuration.
     * Uses caching for better performance on repeated calls.
     * @param elementPath The element path to check.
     * @param includeExternal Whether to include external files.
     * @returns True if the path is included, false otherwise.
     */
    private _pathIsIncluded;
    /**
     * Gets captured values from the captured array and capture configuration.
     * @param captured The array of captured strings.
     * @param captureConfig The configuration for capturing values.
     * @returns The captured values as an object.
     */
    private _getCapturedValues;
    /**
     * Gets the element path based on the path pattern, path segments to the element, and all path segments from the file path.
     * @param pathPattern The element path pattern.
     * @param pathSegments The path segments leading to the element.
     * @param allPathSegments The full path segments from the file path.
     * @returns The element path.
     */
    private _getElementPath;
    /**
     * Determines if an element descriptor matches the given parameters in the provided path.
     * @param options The options for matching the descriptor.
     * @returns The result of the match, including whether it matched and any captured values.
     */
    private _fileDescriptorMatch;
    /**
     * Retrieves the description of a local file given its path.
     * @param elementPath The path of the element to describe.
     * @returns The description of the element.
     */
    private _getFileDescription;
    /**
     * Describes a file given its path.
     * @param includeExternal Whether to include external files (inside node_modules) in the matching process.
     * @param filePath The path of the file to describe.
     * @returns The description of the element.
     */
    private _describeFile;
    /**
     * Returns an external or core dependency element given its dependency source and file path.
     * @param dependencySource The source of the dependency.
     * @param isOutsideRootPath Whether the file path is outside the configured root path.
     * @param filePath The resolved file path of the dependency, if known. Can be absolute if rootPath is configured.
     * @returns The external or core dependency element, or null if it is a local dependency.
     */
    private _getExternalOrCoreDependencyElement;
    /**
     * Describes an element given its file path and dependency source, if any.
     * @param filePath The path of the file to describe. Can be absolute if rootPath is configured, or relative if not.
     * @param dependencySource The source of the dependency, if the element to describe is so. It refers to the import/export path used to reference the file or external module.
     * @returns The description of the element. A dependency element if dependency source is provided, otherwise a file element.
     */
    private _describeElement;
    /**
     * Describes an element given its file path.
     * @param filePath The path of the file to describe. Can be absolute if rootPath is configured, or relative if not.
     * @returns The description of the element.
     */
    describeElement(filePath?: string): FileElement;
    /**
     * Describes a dependency element given its dependency source and file path.
     * @param dependencySource The source of the dependency.
     * @param filePath The path of the file being the dependency, if known. Can be absolute if rootPath is configured, or relative if not.
     * @returns The description of the dependency element.
     */
    describeDependencyElement(dependencySource: string, filePath?: string): DependencyElementDescription;
}

/**
 * Class describing dependencies between elements.
 */
declare class DependenciesDescriptor {
    /**
     * Cache to store previously described dependencies.
     */
    private readonly _dependenciesCache;
    /**
     * Elements descriptor instance.
     */
    private readonly _elementsDescriptor;
    /**
     * Configuration options.
     */
    private readonly _config;
    /**
     * Creates a new DependenciesDescriptor instance.
     * @param elementsDescriptor The elements descriptor instance.
     * @param config The configuration options.
     */
    constructor(elementsDescriptor: ElementsDescriptor, config: DescriptorOptionsNormalized);
    /**
     * Serializes the elements cache to a plain object.
     * @returns The serialized elements cache.
     */
    serializeCache(): DependenciesDescriptorSerializedCache;
    /**
     * Sets the elements cache from a serialized object.
     * @param serializedCache The serialized elements cache.
     */
    setCacheFromSerialized(serializedCache: DependenciesDescriptorSerializedCache): void;
    /**
     * Clears the elements cache.
     */
    clearCache(): void;
    /**
     * Retrieves the element path of the parent of a given element.
     * @param elementInfo The element whose parent is to be retrieved.
     * @returns The parent element path, or undefined if none exists.
     */
    private _getParent;
    /**
     * Retrieves the common ancestor of two elements.
     * @param elementInfoA The first element.
     * @param elementInfoB The second element.
     * @returns The common ancestor element path, or undefined if none exists.
     */
    private _getCommonAncestor;
    /**
     * Checks if the parent of element A is an ancestor of element B.
     * @param elementA The element A.
     * @param elementB The element B.
     * @returns True if the parent of element A is an ancestor of element B, false otherwise.
     */
    private _isDescendantOfParent;
    /**
     * Checks if two elements are siblings (same parent).
     * @param elementA The first element.
     * @param elementB The second element.
     * @returns True if the elements are siblings, false otherwise.
     */
    private _isSibling;
    /**
     * Checks if one element is a descendant of another.
     * @param elementA The potential descendant element.
     * @param elementB The potential ancestor element.
     * @returns True if elementA is a descendant of elementB, false otherwise.
     */
    private _isDescendant;
    /**
     * Checks if one element is a child of another.
     * @param elementA The potential child element.
     * @param elementB The potential parent element.
     * @returns True if elementA is a child of elementB, false otherwise.
     */
    private _isChild;
    /**
     * Checks if two local elements are internally related (same element).
     * @param elementA The first element.
     * @param elementB The second element.
     * @returns True if the elements are internally related, false otherwise.
     */
    private _isInternal;
    /**
     * Retrieves the relationship between two local known elements in terms of dependency.
     * @param element The element depending on another element.
     * @param dependency The element being depended on.
     * @returns The relationship between the elements.
     */
    private _dependencyRelationship;
    private _dependencyRelationships;
    /**
     * Describes elements in a dependency relationship, and provides additional information about the dependency itself.
     * @param options The options for describing the elements and the dependency details.
     * @returns The description of the dependency between the elements.
     */
    describeDependency({ from, to, source, kind, nodeKind, specifiers, }: DescribeDependencyOptions): DependencyDescription;
}

type ObjectCacheKey = Record<string, unknown>;
type NotUndefined = object | string | number | boolean | NotUndefined[];

/**
 * Generic cache manager class. Enables caching of values based on complex keys.
 */
declare class CacheManager<CacheKey extends NotUndefined, CachedValue> {
    /**
     * Internal cache map
     */
    private readonly _cache;
    /**
     * Creates a new CacheManager instance
     */
    constructor();
    /**
     * Generates a string key from the given cache key. Has to be implemented for non-string keys.
     * @param key The cache key to generate from
     * @returns The generated string key
     */
    protected generateKey(key: CacheKey): string;
    /**
     * Generates a hashed key for the given cache key
     * @param key The cache key to hash
     * @returns The hashed key as a string
     */
    getKey(key: CacheKey): string;
    /**
     * Retrieves a value from the cache based on the given hashed key
     * @param hashedKey The hashed key to retrieve
     * @returns The cached value or undefined if not found
     */
    get(hashedKey: string): CachedValue | undefined;
    /**
     * Stores a value in the cache with a given hashed key
     * @param hashedKey The hashed key to store
     * @param value The value to cache
     */
    set(hashedKey: string, value: CachedValue): void;
    /**
     * Checks if a value exists in the cache based on the given hashed key
     * @param hashedKey The hashed key to check
     * @returns True if the value exists, false otherwise
     */
    has(hashedKey: string): boolean;
    /**
     * Retrieves all cached values
     * @returns A map of all cached values
     */
    getAll(): Map<string, CachedValue>;
    /**
     * Clears the entire cache
     */
    clear(): void;
    /**
     * Serializes the  cache to a plain object.
     * @returns The serialized cache.
     */
    serialize(): Record<string, CachedValue>;
    /**
     * Sets the cache from a serialized object.
     * @param serializedCache The serialized cache.
     */
    setFromSerialized(serializedCache: Record<string, CachedValue>): void;
}

export { type BaseDependencyElement, type BaseElement, type BaseElementDescriptor, type BaseElementSelector, type BaseElementSelectorData, type BaseElementSelectorWithOptions, type BaseElementsSelector, CacheManager, type CapturedValues, type CapturedValuesSelector, type ConfigOptions, type ConfigOptionsNormalized, type CoreDependencyElement, DEPENDENCY_KINDS_MAP, DEPENDENCY_KIND_TYPE, DEPENDENCY_KIND_TYPEOF, DEPENDENCY_KIND_VALUE, DEPENDENCY_RELATIONSHIPS_INVERTED_MAP, DEPENDENCY_RELATIONSHIPS_MAP, DependenciesDescriptor, type DependenciesDescriptorSerializedCache, DependenciesMatcher, type DependenciesMatcherSerializedCache, type DependencyDescription, type DependencyElementDescription, type DependencyElementSelector, type DependencyElementSelectorData, type DependencyElementSelectorWithOptions, type DependencyElementsSelector, type DependencyKind, type DependencyMatchResult, type DependencyRelationship, type DependencySelector, type DependencySelectorNormalized, type DescribeDependencyOptions, type DescriptionsSerializedCache, type DescriptorOptionsNormalized, Descriptors, type DescriptorsSerializedCache, ELEMENT_DESCRIPTOR_MODES_MAP, ELEMENT_ORIGINS_MAP, type ElementDescription, type ElementDescriptor, type ElementDescriptorMode, type ElementDescriptorPattern, type ElementDescriptorWithCategory, type ElementDescriptorWithType, type ElementDescriptorWithTypeAndCategory, type ElementDescriptors, type ElementOrigin, type ElementParent, type ElementSelector, type ElementSelectorData, type ElementSelectorWithOptions, type ElementSelectors, Elements, type ElementsDependencyInfo, ElementsDescriptor, type ElementsDescriptorSerializedCache, ElementsMatcher, type ElementsMatcherSerializedCache, type ElementsSelector, type ElementsSerializedCache, type ExternalDependencyElement, type ExternalLibrariesSelector, type ExternalLibrarySelector, type ExternalLibrarySelectorOptions, type ExternalLibrarySelectorWithOptions, type ExternalLibrarySelectors, type FileElement, type FileElementsSerializedCache, type FlagAsExternalOptions, type FlagAsExternalOptionsNormalized, type IgnoredDependencyElement, type IgnoredElement, type LocalDependencyElement, type LocalDependencyElementKnown, type LocalDependencyElementUnknown, type LocalElementKnown, type LocalElementUnknown, Matcher, type MatcherOptions, type MatcherOptionsDependencySelectorsGlobals, type MatcherSerializedCache, type MatchersOptionsNormalized, type MicromatchPattern, type MicromatchSerializedCache, type NotUndefined, type ObjectCacheKey, type SelectableElement, type SimpleElementSelectorByType, type TemplateData, isBaseElement, isBaseElementDescriptor, isBaseElementSelectorData, isCapturedValuesSelector, isCoreDependencyElement, isDependencyDescription, isDependencyElementDescription, isDependencyKind, isDependencyRelationship, isDependencyRelationshipDescription, isDependencySelector, isElementDescription, isElementDescriptor, isElementDescriptorMode, isElementDescriptorPattern, isElementDescriptorWithCategory, isElementDescriptorWithType, isElementSelector, isElementSelectorData, isElementSelectorWithLegacyOptions, isElementsDependencyInfo, isElementsSelector, isExternalDependencyElement, isExternalLibrariesSelector, isExternalLibrarySelector, isExternalLibrarySelectorOptions, isExternalLibrarySelectorOptionsWithPath, isExternalLibrarySelectorOptionsWithSpecifiers, isExternalLibrarySelectorWithOptions, isIgnoredElement, isInternalDependency, isKnownLocalElement, isLocalDependencyElement, isLocalElement, isSimpleElementSelectorByType, isUnknownLocalElement, normalizeElementsSelector };
