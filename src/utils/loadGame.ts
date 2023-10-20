import type {
    IVM,
    IGameServer,
    IGame,
    GameHeader,
    BootFunction,
    BootLike
} from "moroboxai-game-sdk";
import { PluginDriver } from "@/plugin";
import type { LoadBootOptions, LoadHeaderOptions } from "@/plugin";
import type { SDKConfig } from "@/player";
import { startGameServer } from "./startGameServer";

/**
 * Options for the task.
 */
export interface LoadGameOptions {
    // URL of the game
    url: string;
    // Override the boot defined in header
    boot?: BootLike;
    // Config of the SDK
    sdkConfig: SDKConfig;
    // Plugins
    pluginDriver: PluginDriver;
    // VM for the game
    vm: IVM;
    // Called when the header is loaded
    onHeaderLoaded?: (task: LoadGameTask) => void;
    // Called when there is an error loading the header
    onHeaderError?: (task: LoadGameTask) => void;
    // Called when the game is loaded
    onGameLoaded?: (task: LoadGameTask) => void;
    // Called when there is an error loading the game
    onGameError?: (task: LoadGameTask) => void;
}

export class LoadGameTask {
    options: LoadGameOptions;
    // Started game server
    gameServer?: IGameServer;
    // Loaded header
    header?: GameHeader;
    // Context containing the boot
    context?: any;
    // Loaded boot
    boot?: BootFunction;
    // Loaded game
    game?: IGame;
    // Error if any
    error?: any;
    // Has the task completed
    private _isDone: boolean = false;
    // Has a cancel been requested ?
    private _cancelRequested: boolean = false;

    constructor(options: LoadGameOptions) {
        this.options = options;
    }

    /**
     * Load the header.
     */
    loadHeader(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            // Game server
            console.log("start game server...");
            this.gameServer = await startGameServer(
                this.options.sdkConfig,
                this.options.url
            );

            console.log("game server started");

            // Header
            console.log("load game header...");
            const loadHeaderResult =
                await this.options.pluginDriver.hookReduceArg0(
                    "loadHeader",
                    [
                        {
                            url: this.options.url,
                            gameServer: this.gameServer
                        }
                    ],
                    (options, result, plugin) => {
                        if (result !== null) {
                            options.header = result;
                        }
                        return options;
                    }
                );

            this.header = loadHeaderResult.header;
            if (this.header === undefined) {
                throw "could not load game header";
            }
            console.log("game header loaded", this.header);

            return resolve();
        })
            .then(() => {
                this._isDone = true;
                if (this._cancelRequested) {
                    this.cancel();
                    return;
                }
                if (this.options.onHeaderLoaded !== undefined) {
                    this.options.onHeaderLoaded(this);
                }
            })
            .catch((reason: any) => {
                this._isDone = true;
                this.error = reason;
                this.cancel();
                if (this.options.onHeaderError !== undefined) {
                    this.options.onHeaderError(this);
                }
            });
    }

    /**
     * Load the game without booting.
     *
     * This function is written so that it never mutate the player
     * until the very end. This is made so to ensure there is no side effect
     * when the user asks the player to load a game while another one is
     * already loading.
     */
    loadGame(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            if (this.gameServer === undefined || this.header === undefined) {
                throw "no game server or header";
            }

            // Boot
            const boot = this.options.boot ?? this.header.boot;
            if (boot === undefined) {
                throw "missing boot parameter in game header";
            }

            console.log("load game boot...");
            const loadBootOptions: LoadBootOptions = {
                boot,
                gameServer: this.gameServer
            };
            const loadBootResult =
                await this.options.pluginDriver.hookReduceArg0(
                    "loadBoot",
                    [loadBootOptions],
                    (options, result, plugin) => {
                        if (result !== null) {
                            options.boot = result;
                        }
                        return options;
                    }
                );

            if (
                !loadBootResult ||
                loadBootResult.boot === undefined ||
                typeof loadBootResult.boot !== "function"
            ) {
                throw "could not load game boot";
            }
            console.log("game boot loaded", loadBootResult.boot);

            this.context = loadBootResult.context;
            this.boot = loadBootResult.boot;

            // Game
            console.log("boot the game...");
            this.game = await loadBootResult.boot({ vm: this.options.vm });
            console.log("game booted");

            return resolve();
        })
            .then(() => {
                this._isDone = true;
                if (this._cancelRequested) {
                    this.cancel();
                    return;
                }
                if (this.options.onGameLoaded !== undefined) {
                    this.options.onGameLoaded(this);
                }
            })
            .catch((reason: any) => {
                this._isDone = true;
                this.error = reason;
                this.cancel();
                if (this.options.onGameError !== undefined) {
                    this.options.onGameError(this);
                }
            });
    }

    cancel() {
        // Wait for the task to complete
        if (!this._isDone) {
            this._cancelRequested = true;
            return;
        }

        // Cleanup
        if (this.gameServer !== undefined) {
            this.gameServer.close();
            this.gameServer = undefined;
        }
    }
}
