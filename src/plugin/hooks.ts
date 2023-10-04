import type { IGameServer, GameHeader } from "moroboxai-game-sdk";

export interface PluginContext {
    gameServer: IGameServer;
}

// Define hooks
export interface LoadHeaderOptions {
    // URL of the header
    url: string;
    // Header loaded by the previous plugin
    header?: GameHeader;
}

export interface FunctionPluginHooks {
    loadHeader: (this: PluginContext, options: LoadHeaderOptions) => GameHeader;
}

export type SyncPluginHooks = "test";

export type AsyncPluginHooks = Exclude<
    keyof FunctionPluginHooks,
    SyncPluginHooks
>;

// Define the type for plugin
type MakeAsync<Function_> = Function_ extends (
    this: infer This,
    ...parameters: infer Arguments
) => infer Return
    ? (this: This, ...parameters: Arguments) => Return | Promise<Return>
    : never;

// eslint-disable-next-line @typescript-eslint/ban-types
type ObjectHook<T> = T | { handler: T; order?: "pre" | "post" | null };

export type PluginHooks = {
    [K in keyof FunctionPluginHooks]: ObjectHook<
        K extends AsyncPluginHooks
            ? MakeAsync<FunctionPluginHooks[K]>
            : FunctionPluginHooks[K]
    >;
};

export interface Plugin<A = any> extends Partial<PluginHooks> {
    name: string;
    // for inter-plugin communication
    api?: A;
}
