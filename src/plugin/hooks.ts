import type {
    IGameServer,
    GameHeader,
    BootLike,
    IVM,
    IFileServer
} from "moroboxai-game-sdk";
import type { IPlayer } from "@/player/types";
import type { AgentLanguage, IAPI, IAgent } from "@/agent/types";

export interface PluginContext {
    player: IPlayer;
    vm: IVM;
}

// Define hooks
export interface LoadHeaderPluginOptions {
    // URL of the header
    url: string;
    // Game server
    gameServer: IGameServer;
    // Header loaded by the previous plugin
    header?: GameHeader;
}

export interface LoadBootPluginOptions {
    // Game server
    gameServer: IGameServer;
    // Context loaded by the previous plugin
    context?: any;
    // Header loaded by the previous plugin
    boot?: BootLike;
}

export interface LoadAgentPluginOptions {
    // File server
    fileServer?: IFileServer;
    // Language of the script
    language?: AgentLanguage;
    // Script of the agent
    script?: string;
    // Agent loaded by the previous plugin
    agent?: IAgent;
    // API for the agent
    api: IAPI;
}

export interface FunctionPluginHooks {
    loadHeader: (
        this: PluginContext,
        options: LoadHeaderPluginOptions
    ) => GameHeader;
    loadBoot: (this: PluginContext, options: LoadBootPluginOptions) => BootLike;
    loadAgent: (
        this: PluginContext,
        options: LoadAgentPluginOptions
    ) => IAgent | undefined;
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
