import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import type { BootLike } from "moroboxai-game-sdk";
import { Controller, ControllerBus } from "@/controller";
import type { IController } from "@/controller/types";
import UI from "@/ui";
import {
    DEFAULT_GAME_HEIGHT,
    DEFAULT_GAME_WIDTH,
    DEFAULT_GAME_SCALE,
    DEFAULT_GAME_ASPECT_RATIO
} from "@/constants";
import type {
    StretchMode,
    SDKConfig,
    IPlayer,
    PlayerOptions,
    PlayerSaveState,
    AgentLike
} from "@/player/types";
import { PluginContext, PluginDriver, plugins } from "@/plugin";
import LoadGameTask from "@utils/loadGame";
import LoadAgentTask from "@utils/loadAgent";
import type { IAPI as IAgentAPI } from "@agent/types";

// Force displaying the loading screen for x seconds
const FORCE_LOADING_TIME = 1000;
const PHYSICS_TIMESTEP = 0.01;

// Internal player state
export enum EPlayerState {
    Idle,
    Loading,
    BecomePlaying,
    Playing,
    Pause
}

function isHTMLElement(_: Element | HTMLElement): _ is HTMLElement {
    return "dataset" in _;
}

interface Dimension {
    width: number;
    height: number;
}

class AgentAPI implements IAgentAPI {
    require(value: string) {
        throw new Error("Method not implemented.");
    }
}

// Player instance for controlling the game
export class Player implements IPlayer, MoroboxAIGameSDK.IVM, PluginContext {
    private _sdkConfig: SDKConfig;
    private _state: EPlayerState = EPlayerState.Idle;
    private _ui?: UI;
    private _options: PlayerOptions;
    private _pluginDriver: PluginDriver;
    private _agentApi: IAgentAPI;
    // Token passed to promises and used for cancel
    private _readyCallback?: () => void;
    private _loadGameTask?: LoadGameTask;
    // Tasks of loading agents for each controller
    private _loadAgentTask: Map<number, LoadAgentTask> = new Map<
        number,
        LoadAgentTask
    >();
    private _startLoadingDate?: Date;
    // Game server
    private _gameServer?: MoroboxAIGameSDK.IGameServer;
    // Loaded game
    private _header?: MoroboxAIGameSDK.GameHeader;
    private _game?: MoroboxAIGameSDK.IGame;
    private _controllerBus: ControllerBus;
    private _resizeListener?: () => void;
    private _speed: number = 1;
    private _physicsAccumulator: number = 0;
    // Frame counter for player and game
    private _frame: number = 0;
    // Time counter for player and game
    private _time: number = 0;

    constructor(config: SDKConfig, element: Element, options: PlayerOptions) {
        this._sdkConfig = config;
        this._options = options;
        this._pluginDriver = new PluginDriver(
            {
                player: this,
                vm: this
            },
            [
                plugins.defaultPlugin(),
                ...(this._options.plugins !== undefined
                    ? this._options.plugins
                    : [])
            ]
        );
        this._agentApi = new AgentAPI();
        this._controllerBus = new ControllerBus({
            controllers: [
                new Controller({
                    id: 0,
                    inputDevice: config.inputDeviceFactory()
                }),
                new Controller({
                    id: 1
                })
            ]
        });
        if (options.agents !== undefined) {
            if (!Array.isArray(options.agents)) {
                options.agents = [options.agents];
            }

            const controllers: IController[] = Array.from(
                this._controllerBus.controllers.values()
            );
            let index = 0;
            for (let i = 0; i < controllers.length; ++i) {
                this.loadAgent(controllers[i].id, options.agents[index]);
                index = Math.min(index + 1, options.agents.length - 1);
            }
        }
        this._tickFromGame = this._tickFromGame.bind(this);

        if (this._options.onReady !== undefined) {
            this._readyCallback = this._options.onReady;
        }

        if (isHTMLElement(element)) {
            this._options = { ...options };

            if (
                this._options.url === undefined &&
                element.dataset.url !== undefined
            ) {
                this._options.url = element.dataset.url;
            }

            this._attachUi(element);
            this.play({ url: this._options.url });
        }
    }

    get isLoading(): boolean {
        return this._state == EPlayerState.Loading;
    }

    get isPlaying(): boolean {
        return this._state == EPlayerState.Playing;
    }

    get isPaused(): boolean {
        return this._state == EPlayerState.Pause;
    }

    private _attachUi(element: HTMLElement) {
        this._ui = new UI({
            element,
            stretchMode: this._options.stretchMode,
            onPlay: () => this.play(),
            onSpeedSelected: (value: number) => {
                this.speed = value;
            }
        });
        this.resize();

        this._resizeListener = () => this._onResize();
        window.addEventListener("resize", this._resizeListener);
    }

    private _notifyReady(): void {
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    // Load the header
    private _loadHeader(options: { url: string; autoPlay?: boolean }) {
        this._options.url = options.url;

        // Cancel the previous load
        this._loadGameTask?.cancel();

        // Stop the current game
        this.stop();

        // Show loading
        this._state = EPlayerState.Loading;
        this._ui?.loading();

        // Create a new task for loading the header
        this._loadGameTask = new LoadGameTask({
            url: this.url,
            boot: this._options.boot,
            sdkConfig: this._sdkConfig,
            pluginDriver: this._pluginDriver,
            vm: this,
            onHeaderLoaded: (task) => {
                this._gameServer = task.gameServer!;
                this._header = task.header!;
                this.resize();

                // Change the preview image
                if (this._ui !== undefined) {
                    this._ui.backgroundImage =
                        this._header.previewUrl !== undefined
                            ? `url('${this._gameServer.href(
                                  this._header.previewUrl
                              )}')`
                            : "";
                }

                // Optionally play the game
                if ((options.autoPlay ?? this._options.autoPlay) === true) {
                    this._play();
                } else {
                    this._state = EPlayerState.Idle;
                    this._ui?.stopped();
                }
            },
            onHeaderError: (task) => {
                // Check if an error occurred
                if (task.error !== undefined) {
                    console.error(task.error);
                }
            },
            onGameLoaded: (task) => {
                this._game = task.game!;
                this._game.ticker = this._tickFromGame;

                // Create the controllers required by the game
                /*this._controllerBus = new ControllerBus({
                    controllers: []
                });*/

                // Resize the player and game
                this.resize();

                // Set the player as ready
                this._ready();
            },
            onGameError: (task) => {
                // Check if an error occurred
                if (task.error !== undefined) {
                    console.error(task.error);
                }
            }
        });
        this._loadGameTask.loadHeader();
    }

    private _play(): void {
        // Unpause the game if possible
        if (this._state === EPlayerState.Pause) {
            this._state = EPlayerState.Playing;

            this._ui?.playing();

            if (this._game !== undefined) {
                this._game.play();
            }

            return;
        }

        if (this._loadGameTask === undefined) {
            throw "player not ready for play";
        }

        // Load the game
        this._state = EPlayerState.Loading;
        this._startLoadingDate = new Date();

        // Should never happen
        if (this._ui === undefined) {
            throw "no player UI";
        }

        // Show the loading state
        this._ui.loading();

        // Remove the preview image
        this._ui.backgroundImage = undefined;

        this._loadGameTask.loadGame();
    }

    // PluginContext interface
    get player(): IPlayer {
        return this;
    }

    get vm(): MoroboxAIGameSDK.IVM {
        return this;
    }

    // IVM interface
    get root(): HTMLElement {
        return this._ui!.gameRoot;
    }

    get gameServer(): MoroboxAIGameSDK.IGameServer {
        return this._loadGameTask?.gameServer! as MoroboxAIGameSDK.IGameServer;
    }

    /**
     * Find the native game size.
     */
    private _nativeGameSize(): Dimension {
        const width = this._header?.width;
        const height = this._header?.height;
        // The game specifies both its with and height
        if (width !== undefined && height !== undefined) {
            return {
                width,
                height
            };
        }

        const aspectRatio =
            this.header?.aspectRatio ?? DEFAULT_GAME_ASPECT_RATIO;
        const [a, b] = aspectRatio
            .split("/")
            .map((value: string) => parseInt(value));
        // The game specifies only its width, so compute the height
        if (width !== undefined) {
            return { width, height: (width * b) / a };
        }

        // The game specifies only its height, so compute the width
        if (height !== undefined) {
            return { width: (height * a) / b, height };
        }

        // Fallback to default game size
        return {
            width: DEFAULT_GAME_WIDTH,
            height: DEFAULT_GAME_HEIGHT
        };
    }

    /**
     * Optimal player size to display the game.
     */
    private _optimalPlayerSize(): Dimension {
        const gameSize = this._nativeGameSize();
        const scale = this.scale / this.gameScale;

        return {
            width: gameSize.width * scale,
            height: gameSize.height * scale
        };
    }

    resize(): void;
    resize(width: number | string, height: number | string): void;
    resize(options: {
        width?: number | string;
        height?: number | string;
    }): void;
    resize(
        width?:
            | { width?: number | string; height?: number | string }
            | number
            | string,
        height?: number | string
    ) {
        if (width !== undefined) {
            if (typeof width === "object") {
                this._options.width = width.width;
                this._options.height = width.height;
            } else {
                this._options.width = width;
                this._options.height = height;
            }
            this.resize();
            return;
        }

        // Optimal player size of the game
        const playerSize = this._optimalPlayerSize();

        // Set the player size defined in options
        const fixedMode = this.stretchMode === "fixed";

        // In fixed mode, we take the size from options in priority, then the
        // optimal size of the player.
        // In fill mode, we take the size from options if defined, else we
        // don't touch at the size.
        let playerWidth =
            this._options.width ?? (fixedMode ? playerSize.width : undefined);
        let playerHeight =
            this._options.height ?? (fixedMode ? playerSize.height : undefined);

        // Resize the UI
        this._ui?.resize({
            width: playerWidth,
            height: playerHeight,
            aspectRatio: `${playerSize.width}/${playerSize.height}`
        });

        this._onResize();
    }

    private _onResize(): void {
        if (this._game !== undefined) {
            this._game.resize();
        }
    }

    // Allow SDK user to know when the game is playing
    get onReady(): (() => void) | undefined {
        return this._readyCallback;
    }

    set onReady(callback: (() => void) | undefined) {
        this._readyCallback = callback;
        if (this.isPlaying) {
            this._notifyReady();
        }
    }

    // Called when the game is loaded and ready to play
    private _ready(): void {
        if (this._state != EPlayerState.Loading) {
            return;
        }

        this._state = EPlayerState.BecomePlaying;

        const timeRemaining =
            FORCE_LOADING_TIME - (+new Date() - +this._startLoadingDate!);
        if (timeRemaining > 0) {
            setTimeout(() => this._ready_after_loading(), timeRemaining);
            return;
        }

        this._ready_after_loading();
    }

    private _ready_after_loading() {
        if (this._state !== EPlayerState.BecomePlaying) {
            return;
        }

        this._state = EPlayerState.Playing;

        // Resize the player
        if (this._game !== undefined) {
            this.scale = this._options.scale ?? 1;
        }

        this._ui?.playing();

        if (this._game) {
            this._game.play();
        }

        this._notifyReady();
    }

    getController(id: number): IController | undefined {
        return this._controllerBus.get(id);
    }

    loadAgent(controllerId: number, options: AgentLike): Promise<void> {
        // Cancel previous task if any
        this._loadAgentTask.get(controllerId)?.cancel();

        // Create a new task for loading the agent
        const task = new LoadAgentTask({
            options: options,
            sdkConfig: this._sdkConfig,
            pluginDriver: this._pluginDriver,
            api: this._agentApi,
            onAgentLoaded: (task) => {
                const controller = this.getController(controllerId);
                if (controller !== undefined) {
                    controller.agent = task.agent!;
                }
            },
            onAgentError: (task) => {
                // Check if an error occurred
                if (task.error !== undefined) {
                    console.error(task.error);
                }
            }
        });

        this._loadAgentTask.set(controllerId, task);

        return task.loadAgent();
    }

    unloadAgent(controllerId: number): void {
        const controller = this.getController(controllerId);
        if (controller !== undefined) {
            controller.agent = undefined;
        }
    }

    // IPlayer interface
    get width(): number {
        return this._ui?.width ?? 0;
    }

    set width(value: number) {
        this.resize({ width: value });
    }

    get height(): number {
        return this._ui?.height ?? 0;
    }

    set height(value: number) {
        this.resize({ height: value });
    }

    get scale(): number {
        return this._options.scale ?? 1;
    }

    set scale(value: number) {
        this._options.scale = value;
        this.resize();
    }

    get stretchMode(): StretchMode {
        return this._options.stretchMode ?? "fixed";
    }

    set stretchMode(value: StretchMode) {
        this._options.stretchMode = value;
        this.resize();
    }

    get gameWidth(): number {
        return this._nativeGameSize().width;
    }

    get gameHeight(): number {
        return this._nativeGameSize().height;
    }

    get gameScale(): number {
        return this._header?.scale ?? DEFAULT_GAME_SCALE;
    }

    get gameAspectRatio(): string {
        return this._header?.aspectRatio ?? DEFAULT_GAME_ASPECT_RATIO;
    }

    get resizable(): boolean {
        return this._options.resizable === true;
    }

    set resizable(value: boolean) {
        this._options.resizable = value;
    }

    get speed(): number {
        return this._speed;
    }

    set speed(value: number) {
        this._speed = value;
    }

    get url(): string {
        return this._options.url;
    }

    set url(value: string) {
        this._loadHeader({ url: value });
    }

    get boot(): BootLike | undefined {
        return this._options.boot;
    }

    set boot(val: BootLike | undefined) {
        this._options.boot = val;
    }

    get header(): MoroboxAIGameSDK.GameHeader | undefined {
        return this._loadGameTask?.header;
    }

    get autoPlay(): boolean {
        return this._options.autoPlay === true;
    }

    set autoPlay(value: boolean) {
        this._options.autoPlay = value;
    }

    get simulated(): boolean {
        return this._options.simulated === true;
    }

    set simulated(value: boolean) {
        this._options.simulated = value;
    }

    get frame(): number {
        return this._frame;
    }

    get time(): number {
        return this._time;
    }

    ticker?: (detla: number) => void;

    play(): void;
    play(url: string): void;
    play(options: { url: string; autoPlay?: boolean }): void;
    play(
        options?:
            | string
            | {
                  url: string;
                  autoPlay?: boolean;
              }
    ): void {
        if (typeof options === "object") {
            // Load a new game
            this._loadHeader({ url: options.url, autoPlay: options.autoPlay });
            return;
        }

        if (options !== undefined) {
            // Load a new game
            this._loadHeader({ url: options });
            return;
        }

        // Keep the current game
        this._play();
    }

    pause(): void {
        if (!this.isPlaying) return;

        if (this._game !== undefined) {
            this._game.pause();
        }

        this._ui?.paused();

        this._state = EPlayerState.Pause;
    }

    stop(): void {
        if (this._game !== undefined) {
            this._game.stop();
            this._game = undefined;
        }

        this._ui?.stopped();

        if (this._gameServer !== undefined) {
            this._gameServer.close();
            this._gameServer = undefined;
        }

        this._loadGameTask = undefined;

        this._speed = 1;
        this._state = EPlayerState.Idle;
    }

    reload(): void {
        this.stop();
        this.play();
    }

    remove(): void {
        this.stop();

        if (this._resizeListener !== undefined) {
            window.removeEventListener("resize", this._resizeListener);
        }

        if (this._ui !== undefined) {
            this._ui.remove();
            this._ui = undefined;
        }
    }

    saveState(): PlayerSaveState {
        return {
            // Required from GameSaveState but not used
            isGameOver: false,
            physicsAccumulator: this._physicsAccumulator,
            game: this._game?.saveState(),
            controllers: this._controllerBus.saveState()
        };
    }

    loadState(state?: PlayerSaveState): void {
        this._physicsAccumulator = state?.physicsAccumulator ?? 0;
        this._game?.loadState(state?.game);
        this._controllerBus.loadState(state?.controllers ?? [{}, {}]);
    }

    _tickFromGame(delta: number): void {
        // Hook registered
        if (this.ticker !== undefined) {
            this.ticker(delta);
            return;
        }

        // In simulated mode, the player doesn't run by itself
        if (!this.simulated) {
            this.tick(delta);
        }
    }

    tick(delta: number): void {
        if (this._game === undefined) {
            return;
        }

        this._physicsAccumulator += delta * this.speed;
        while (this._physicsAccumulator > PHYSICS_TIMESTEP) {
            this._tickOneFrame(PHYSICS_TIMESTEP, false);
            this._physicsAccumulator -= PHYSICS_TIMESTEP;
        }

        // Render the last frame
        this._tickOneFrame(PHYSICS_TIMESTEP, true);

        // Check for game over
        const state = this._game.saveState();
        if (state.isGameOver) {
            // Reset the game
            this._game.loadState();
        }
    }

    _tickOneFrame(delta: number, render: boolean): void {
        if (this._game === undefined) {
            return;
        }

        // Increase time
        this._time += delta;
        this._frame++;
        // Ask the agents the next inputs and tick the game
        const state = this._game.getStateForAgent();
        this._game.tick(this._controllerBus.inputs(state), delta, render);
    }
}
