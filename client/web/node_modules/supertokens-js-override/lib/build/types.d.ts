export declare type ProxiedImplementation<T> = {
    [P in keyof T]: T[P];
} & {
    _call: <K extends keyof T>(fname: K, args: any[]) => T[K];
};
export declare type NullablePartial<T> = {
    [P in keyof T]?: null | T[P];
};
