import type {
    IGameServer,
    GameHeader,
    BootLike,
    IVM
} from "moroboxai-game-sdk";
import type { IPlayer } from "@/player";

export interface PluginContext {
    player: IPlayer;
    vm: IVM;
}

// Define hooks
export interface LoadHeaderOptions {
    // URL of the header
    url: string;
    // Game server
    gameServer: IGameServer;
    // Header loaded by the previous plugin
    header?: GameHeader;
}

export interface LoadBootOptions {
    // Game server
    gameServer: IGameServer;
    // Context loaded by the previous plugin
    context?: any;
    // Header loaded by the previous plugin
    boot?: BootLike;
}

export interface FunctionPluginHooks {
    loadHeader: (this: PluginContext, options: LoadHeaderOptions) => GameHeader;
    loadBoot: (this: PluginContext, options: LoadBootOptions) => BootLike;
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
