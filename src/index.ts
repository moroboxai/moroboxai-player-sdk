import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import type { GameHeader, BootLike } from "moroboxai-game-sdk";
import { ControllerBus } from "./controller";
import type { IController } from "./controller";
export type {
    AgentLanguage,
    LoadAgentOptions,
    IInputController,
    IController
} from "./controller";
import { Overlay } from "./overlay";
import { DEFAULT_PLAYER_HEIGHT, DEFAULT_PLAYER_WIDTH } from "./constants";
import type { ISDKConfig, IPlayer, PlayerOptions } from "./player";
export * from "./player";
import { PluginContext, PluginDriver, plugins } from "./plugin";
export * from "./plugin";
import { LoadGameTask } from "./utils/loadGame";

/**
 * Version of the game SDK.
 */
export { VERSION as GAME_SDK_VERSION } from "moroboxai-game-sdk";

/**
 * Version of the SDK.
 */
export const VERSION: string = "__VERSION__";

// Force displaying the loading screen for x seconds
const FORCE_LOADING_TIME = 1000;
const PHYSICS_TIMESTEP = 0.01;

export interface IMetaPlayer extends IPlayer {
    // Add a player to the list
    addPlayer(other: IPlayer): void;

    // Remove a player from the list
    removePlayer(other: IPlayer): void;
}

// Internal player state
enum EPlayerState {
    Idle,
    Loading,
    BecomePlaying,
    Playing,
    Pause
}

// Player instance for controlling the game
class Player implements IPlayer, MoroboxAIGameSDK.IVM, PluginContext {
    private _sdkConfig: ISDKConfig;
    private _state: EPlayerState = EPlayerState.Idle;
    private _ui: {
        element?: HTMLElement;
        wrapper?: HTMLElement;
        base?: HTMLElement;
        overlay?: Overlay;
    } = {};
    private _options: PlayerOptions;
    private _pluginDriver: PluginDriver;
    // Token passed to promises and used for cancel
    private _readyCallback?: () => void;
    private _loadGameTask?: LoadGameTask;
    private _startLoadingDate?: Date;
    // Game server
    private _gameServer?: MoroboxAIGameSDK.IGameServer;
    // Loaded game
    private _game?: MoroboxAIGameSDK.IGame;
    private _controllerBus: ControllerBus;
    private _resizeListener?: () => void;
    private _speed: number = 1;
    private _physicsAccumulator: number = 0;
    // Frame counter for player and game
    private _frame: number = 0;
    // Time counter for player and game
    private _time: number = 0;

    constructor(config: ISDKConfig, element: Element, options: PlayerOptions) {
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
        this._controllerBus = new ControllerBus({
            inputController: config.inputController
        });
        if (options.agents !== undefined) {
            options.agents.map((agent, index) => {
                const controller = this._controllerBus.get(index);
                if (controller !== undefined) {
                    controller.loadAgent(agent);
                }
            });
        }
        this._tickFromGame = this._tickFromGame.bind(this);

        if (this._options.onReady !== undefined) {
            this._readyCallback = this._options.onReady;
        }

        if (isHTMLElement(element)) {
            this._ui.element = element as HTMLElement;
            this._options = { ...options };

            if (
                this._options.url === undefined &&
                element.dataset.url !== undefined
            ) {
                this._options.url = element.dataset.url;
            }

            this._attach();

            if (this.autoPlay) {
                this.play();
            }
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

    private _attach() {
        if (this._ui.element === undefined) {
            return;
        }

        {
            let div = document.createElement("div");
            this._ui.wrapper = div;
            div.addEventListener("mouseenter", () => this._onMouseEnter());
            div.addEventListener("mousemove", () => this._onMouseMove());
            div.addEventListener("mouseleave", () => this._onMouseLeave());
            div.style.position = "relative";
            div.style.backgroundSize = "cover";

            if (this._options.splashart !== undefined) {
                div.style.backgroundImage = `url('${this._options.splashart}')`;
            }

            this._ui.element.appendChild(div);
        }

        {
            let div = document.createElement("div");
            this._ui.base = div;
            div.style.width = "100%";
            div.style.height = "100%";
            div.style.position = "absolute";
            div.style.left = "0";
            div.style.top = "0";
            this._ui.wrapper.appendChild(div);
        }

        if (
            this._options.width === undefined &&
            this._options.height === undefined
        ) {
            this._options.width = DEFAULT_PLAYER_WIDTH;
            this._options.height = DEFAULT_PLAYER_HEIGHT;
        }

        this.resize({
            width: this._options.width,
            height: this._options.height
        });

        this._ui.overlay = new Overlay(this._ui.wrapper);
        this._ui.overlay.onPlay = () => this.play();
        this._ui.overlay.onSpeed = (value: number) => (this.speed = value);

        this._resizeListener = () => this._onResize();
        window.addEventListener("resize", this._resizeListener);
    }

    private _notifyReady(): void {
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    private _play(url?: string, autoPlay?: boolean): void {
        if (url !== undefined) {
            // Changing the URL stops the game
            this.stop();

            this._options.url = url ?? this._options.url;

            // Play the game if required
            if (autoPlay === true || this.autoPlay) {
                this._play();
            }
            return;
        }

        // No URL, nor header change, unpause the game
        if (this._state === EPlayerState.Pause) {
            this._state = EPlayerState.Playing;

            if (this._ui.overlay) {
                this._ui.overlay.playing();
            }

            if (this._game !== undefined) {
                this._game.play();
            }

            return;
        }

        // Can't call play while there is already a game playing
        if (this._state !== EPlayerState.Idle) {
            console.error("a game is already playing, call stop before");
            return;
        }

        this._state = EPlayerState.Loading;
        this._startLoadingDate = new Date();

        if (this._ui.overlay) {
            this._ui.overlay.loading();
        }

        // Should never happen
        if (this._ui.element === undefined) {
            throw "no root HTML element";
        }

        // Create a new task for loading the game
        this._loadGameTask = new LoadGameTask({
            sdkConfig: this._sdkConfig,
            url: this._options.url,
            boot: this._options.boot,
            pluginDriver: this._pluginDriver,
            vm: this,
            callback: (task) => {
                // Check if an error occurred
                if (task.error !== undefined) {
                    console.log(task.error);
                }

                this._game = task.game!;
                this._game.ticker = this._tickFromGame;
                this._gameServer = task.gameServer;
                this._ready();
            }
        });
        this._loadGameTask.loadGame();
    }

    _onMouseEnter() {
        if (this._ui.overlay) {
            this._ui.overlay.mouseEnter();
        }
    }

    _onMouseMove() {
        if (this._ui.overlay) {
            this._ui.overlay.mouseMove();
        }
    }

    _onMouseLeave() {
        if (this._ui.overlay) {
            this._ui.overlay.mouseLeave();
        }
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
        return this._ui.base as HTMLElement;
    }

    get gameServer(): MoroboxAIGameSDK.IGameServer {
        return this._loadGameTask?.gameServer! as MoroboxAIGameSDK.IGameServer;
    }

    resize(width: number, height: number): void;
    resize(options: { width?: number; height?: number }): void;
    resize(
        width?: { width?: number; height?: number } | number,
        height?: number
    ) {
        if (this._ui.wrapper === undefined) return;

        if (typeof width !== "number") {
            height = width!.height;
            width = width!.width;
        }

        if (width !== undefined) {
            this._ui.wrapper.style.width = `${Math.round(width)}px`;
        } else {
            this._ui.wrapper.style.width = "100%";
        }

        if (height !== undefined) {
            this._ui.wrapper.style.height = `${Math.round(height)}px`;
        } else {
            this._ui.wrapper.style.height = "100%";
        }

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

        if (this._ui.overlay) {
            this._ui.overlay.playing();
        }

        if (this._game) {
            this._game.play();
        }

        this._notifyReady();
    }

    getController(id: number): IController | undefined {
        return this._controllerBus.get(id);
    }

    // IPlayer interface
    get width(): number {
        return this._ui.wrapper ? this._ui.wrapper.clientWidth : 0;
    }

    set width(value: number) {
        this.resize({ width: value });
    }

    get height(): number {
        return this._ui.wrapper ? this._ui.wrapper.clientHeight : 0;
    }

    set height(value: number) {
        this.resize({ height: value });
    }

    get scale(): number {
        if (this._game === undefined) {
            return 1;
        }

        return Math.min(
            this.width / this._game.width,
            this.height / this._game.height
        );
    }

    set scale(value: number) {
        if (this._game !== undefined) {
            value /= this._game.scale ?? 1;

            this.resize({
                width: this._game.width * value,
                height: this._game.height * value
            });
        }
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
        this.play({ url: value });
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
            this._play(options.url, options.autoPlay);
            return;
        }

        if (options !== undefined) {
            this._play(options);
            return;
        }

        this._play();
    }

    pause(): void {
        if (!this.isPlaying) return;

        if (this._game !== undefined) {
            this._game.pause();
        }

        if (this._ui.overlay) {
            this._ui.overlay.paused();
        }

        this._state = EPlayerState.Pause;
    }

    stop(): void {
        if (this._game !== undefined) {
            this._game.stop();
            this._game = undefined;
        }

        if (this._ui.overlay) {
            this._ui.overlay.stopped();
        }

        if (this._gameServer !== undefined) {
            this._gameServer.close();
            this._gameServer = undefined;
        }

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

        if (this._ui.overlay) {
            this._ui.overlay.remove();
            this._ui.overlay = undefined;
        }

        if (this._ui.wrapper) {
            this._ui.wrapper.remove();
            this._ui.wrapper = undefined;
        }
    }

    saveState(): object {
        return {
            physicsAccumulator: this._physicsAccumulator,
            game: this._game !== undefined ? this._game.saveState() : {},
            controllers: this._controllerBus.saveState()
        };
    }

    loadState(state: any): void {
        this._physicsAccumulator =
            state.physicsAccumulator !== undefined
                ? state.physicsAccumulator
                : 0;
        if (this._game !== undefined) {
            this._game.loadState(state.game !== undefined ? state.game : {});
        }
        this._controllerBus.loadState(
            state.controllers !== undefined ? state.controllers : [{}, {}]
        );
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
    }

    _tickOneFrame(delta: number, render: boolean): void {
        // Increase time
        this._time += delta;
        this._frame++;
        // Ask the agents the next inputs and tick the game
        const state = this._game!.getStateForAgent();
        this._game!.tick(this._controllerBus.inputs(state), delta, render);
    }
}

/**
 * Gets default configured player options.
 * @returns {PlayerOptions} Default options
 */
export function defaultOptions(): PlayerOptions {
    return {
        url: "",
        resizable: true,
        speed: 1
    };
}

export interface GameSDKOptions {
    // Local file server
    fileServer: MoroboxAIGameSDK.IFileServer;
}

function isHTMLElement(_: Element | HTMLElement): _ is HTMLElement {
    return "dataset" in _;
}

function isElementArray(
    _: PlayerOptions | Element | Element[] | HTMLCollectionOf<Element>
): _ is Element[] | HTMLCollectionOf<Element> {
    return "length" in _;
}

function isPlayerOptions(
    _?: PlayerOptions | Element | Element[] | HTMLCollectionOf<Element>
): _ is PlayerOptions {
    return _ !== undefined && !isElementArray(_) && !("className" in _);
}

function createPlayer(
    config: ISDKConfig,
    element: Element,
    options: PlayerOptions
): IPlayer {
    return new Player(config, element, options);
}

export function init(config: ISDKConfig): IPlayer | IPlayer[];
export function init(
    config: ISDKConfig,
    options: PlayerOptions
): IPlayer | IPlayer[];
export function init(config: ISDKConfig, element: Element): IPlayer;
export function init(
    config: ISDKConfig,
    element: Element[] | HTMLCollectionOf<Element>
): IPlayer[];
export function init(
    config: ISDKConfig,
    element: Element,
    options: PlayerOptions
): IPlayer;
export function init(
    config: ISDKConfig,
    element: Element[] | HTMLCollectionOf<Element>,
    options: PlayerOptions
): IPlayer[];
export function init(
    config: ISDKConfig,
    element?: PlayerOptions | Element | Element[] | HTMLCollectionOf<Element>,
    options?: PlayerOptions
): IPlayer | IPlayer[];

/**
 * Initialize player on one or multiple HTML elements.
 * @param {HTMLElement} element Element to wrap
 * @param {PlayerOptions} options Options for initializing the player
 */
export function init(
    config: ISDKConfig,
    element?: PlayerOptions | Element | Element[] | HTMLCollectionOf<Element>,
    options?: PlayerOptions
): IPlayer | IPlayer[] {
    let _elements: undefined | Element | Element[] | HTMLCollectionOf<Element> =
        undefined;
    let _options: PlayerOptions = defaultOptions();

    if (isPlayerOptions(element)) {
        options = element;
    } else {
        _elements = element;
    }

    if (options !== undefined) {
        _options = { ..._options, ...options };
    }

    if (_elements == undefined) {
        if (_options.element !== undefined) {
            _elements = _options.element;
        } else {
            _elements = document.getElementsByClassName("moroboxai-player");
        }
    }

    if (!isElementArray(_elements)) {
        return createPlayer(config, _elements, _options);
    }

    return Array.prototype.map.call(_elements, (_) =>
        createPlayer(config, _, _options)
    ) as IPlayer[];
}

export class MetaPlayer implements IMetaPlayer {
    private _players: Array<IPlayer> = [];

    constructor(players?: Array<IPlayer>) {
        this._tickFromGame = this._tickFromGame.bind(this);
        this._handleReady = this._handleReady.bind(this);

        if (players !== undefined) {
            players.forEach((other) => this.addPlayer(other));
        }
    }

    get masterPlayer(): IPlayer | undefined {
        return this._players !== undefined ? this._players[0] : undefined;
    }

    get speed(): number {
        return this.masterPlayer!.speed;
    }

    set speed(val: number) {
        this._players.forEach((other) => (other.speed = val));
    }

    get width(): number {
        return this.masterPlayer!.width;
    }

    set width(val: number) {
        this._players.forEach((other) => (other.width = val));
    }

    get height(): number {
        return this.masterPlayer!.height;
    }

    set height(val: number) {
        this._players.forEach((other) => (other.height = val));
    }

    get scale(): number {
        return this.masterPlayer!.scale;
    }

    set scale(val: number) {
        this._players.forEach((other) => (other.scale = val));
    }

    get resizable(): boolean {
        return this.masterPlayer!.resizable;
    }

    set resizable(val: boolean) {
        this._players.forEach((other) => (other.resizable = val));
    }

    get url(): string {
        return this.masterPlayer!.url;
    }

    get boot(): BootLike | undefined {
        return this.masterPlayer!.boot;
    }

    set boot(val: BootLike | undefined) {
        this.masterPlayer!.boot = val;
    }

    get header(): MoroboxAIGameSDK.GameHeader | undefined {
        return this.masterPlayer!.header;
    }

    get autoPlay(): boolean {
        return this.masterPlayer!.autoPlay;
    }

    set autoPlay(val: boolean) {
        this._players.forEach((other) => (other.autoPlay = val));
    }

    get simulated(): boolean {
        return false;
    }

    set simulated(val: boolean) {}

    ticker?: ((delta: number) => void) | undefined;

    get isLoading(): boolean {
        return this.masterPlayer!.isLoading;
    }

    get isPlaying(): boolean {
        return this.masterPlayer!.isPlaying;
    }

    get isPaused(): boolean {
        return this.masterPlayer!.isPaused;
    }

    play(
        options?:
            | string
            | {
                  url: string;
                  boot?: BootLike;
                  autoPlay?: boolean;
              }
    ): void {
        var _options: {
            url: string;
            boot?: BootLike;
            autoPlay?: boolean;
        } = { url: this.url, boot: undefined, autoPlay: true };
        if (options === undefined) {
        } else if (typeof options === "string") {
            _options.url = options;
        } else {
            _options.url = options.url;
            _options.boot = options.boot;
        }

        this._players.forEach((other) => other.play(_options));
    }

    onReady?: (() => void) | undefined;

    pause() {
        this._players.forEach((other) => other.pause());
    }

    stop() {
        this._players.forEach((other) => other.stop());
    }

    saveState(): object {
        return this.masterPlayer!.saveState();
    }

    loadState(state: object) {
        this._players.forEach((other) => other.loadState(state));
    }

    _tickFromGame(delta: number) {
        this.tick(delta);
    }

    tick(delta: number) {
        const state = this.saveState();
        this._players.forEach((other) => {
            other.loadState(state);
            other.tick(delta);
        });
    }

    remove(): void {}

    resize(
        width: { width?: number; height?: number } | number,
        height?: number
    ): void {
        if (typeof width === "object") {
            this._players.forEach((other) => other.resize(width));
        } else if (height !== undefined) {
            this._players.forEach((other) => other.resize(width, height));
        }
    }

    _handleReady() {
        if (this._players.every((other) => other.isPlaying)) {
            this.ready();
        }
    }

    ready() {
        if (this.onReady !== undefined) {
            this.onReady();
        }
    }

    addPlayer(other: IPlayer) {
        this._players.push(other);

        other.ticker =
            this._players.length === 1 ? this._tickFromGame : undefined;
        other.simulated = true;
        other.onReady = this._handleReady;
    }

    removePlayer(other: IPlayer) {
        const index = this._players.indexOf(other);
        if (index < 0) {
            return;
        }

        delete this._players[index];
        other.ticker = undefined;
        other.simulated = false;
    }

    getController(controllerId: number): IController | undefined {
        return this.masterPlayer!.getController(controllerId);
    }
}
