import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import { ControllerBus } from "./controller";
import type { IInputController, IController } from "./controller";
import { Overlay } from "./overlay";
import { GameServer } from "./server";
import { DEFAULT_PLAYER_HEIGHT, DEFAULT_PLAYER_WIDTH } from "./constants";
import type { IPlayer, IPlayerOptions } from "./player";
export * from "./player";
import { PluginContext, PluginDriver, defaultPlugin } from "./plugin";
export * from "./plugin";

export type {
    AgentLanguage,
    IAgentOptions,
    IAgent,
    IInputController,
    IController
} from "./controller";

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

export interface ISDKConfig {
    // Create a controller listening for player inputs
    inputController: () => IInputController;
    // Create a file server for a given URL
    fileServer: (baseUrl: string) => MoroboxAIGameSDK.IFileServer;
    // Create a zip server for a given URL
    zipServer: (zipUrl: string) => MoroboxAIGameSDK.IFileServer;
}

/**
 * Create a file server base on URL ending.
 * @param {string} baseUrl - Base URL
 * @returns {MoroboxAIGameSDK.IFileServer} A file server
 */
function createFileServer(
    sdkConfig: ISDKConfig,
    baseUrl: string
): MoroboxAIGameSDK.IFileServer {
    // Point to zip file
    if (baseUrl.endsWith(".zip")) {
        return sdkConfig.zipServer(baseUrl);
    }

    // Point to header.yml so take parent URL
    if (baseUrl.endsWith(".yaml") || baseUrl.endsWith(".yml")) {
        const pos = baseUrl.lastIndexOf("/");
        baseUrl = pos < 0 ? "" : baseUrl.substring(0, pos);
    }

    return sdkConfig.fileServer(baseUrl);
}

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

class PlayerProxy implements MoroboxAIGameSDK.IPlayer {
    private _player: MoroboxAIGameSDK.IPlayer;

    constructor(player: MoroboxAIGameSDK.IPlayer) {
        this._player = player;
    }

    get root(): HTMLElement {
        return this._player.root;
    }

    get gameServer(): MoroboxAIGameSDK.IGameServer {
        return this._player.gameServer;
    }

    get width(): number {
        return this._player.width;
    }

    set width(value: number) {
        this.resize({ width: value });
    }

    get height(): number {
        return this._player.height;
    }

    set height(value: number) {
        this.resize({ height: value });
    }

    get resizable(): boolean {
        return this._player.resizable;
    }

    get speed(): number {
        return this._player.speed;
    }

    get header(): MoroboxAIGameSDK.GameHeader | undefined {
        return this._player.header;
    }

    get frame(): number {
        return this._player.frame;
    }

    get time(): number {
        return this._player.time;
    }

    resize(
        width: { width?: number; height?: number } | number,
        height?: number
    ): void {
        if (!this.resizable) return;

        if (typeof width === "object") {
            this._player.resize(width);
        } else {
            this._player.resize(width, height!);
        }
    }

    getController(
        controllerId: number
    ): MoroboxAIGameSDK.IController | undefined {
        return this._player.getController(controllerId);
    }
}

// Player instance for controlling the game
class Player implements IPlayer, MoroboxAIGameSDK.IPlayer, PluginContext {
    private _proxy: PlayerProxy;
    private _config: ISDKConfig;
    private _state: EPlayerState = EPlayerState.Idle;
    private _ui: {
        element?: HTMLElement;
        wrapper?: HTMLElement;
        base?: HTMLElement;
        overlay?: Overlay;
    } = {};
    private _options: IPlayerOptions;
    private _pluginDriver: PluginDriver;
    private _readyCallback?: () => void;
    private _playTask?: Promise<void>;
    private _startLoadingDate?: Date;
    private _gameServer?: MoroboxAIGameSDK.IGameServer;
    private _exports: {
        boot?: MoroboxAIGameSDK.IBoot;
    } = {};
    private _game?: MoroboxAIGameSDK.IGame;
    private _controllerBus: ControllerBus;
    private _resizeListener?: () => void;
    private _speed: number = 1;
    private _physicsAccumulator: number = 0;
    // Frame counter for player and game
    private _frame: number = 0;
    // Time counter for player and game
    private _time: number = 0;

    get isLoading(): boolean {
        return this._state == EPlayerState.Loading;
    }

    get isPlaying(): boolean {
        return this._state == EPlayerState.Playing;
    }

    get isPaused(): boolean {
        return this._state == EPlayerState.Pause;
    }

    constructor(config: ISDKConfig, element: Element, options: IPlayerOptions) {
        this._proxy = new PlayerProxy(this);
        this._config = config;
        this._options = options;
        this._pluginDriver = new PluginDriver(this, [
            defaultPlugin(),
            ...(this._options.plugins !== undefined
                ? this._options.plugins
                : [])
        ]);
        this._controllerBus = new ControllerBus({
            player: this,
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

    // This task is for loading the game
    private _initGame(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this._ui.element === undefined) {
                return reject("element is not an HTMLElement");
            }

            console.log("start game server...");
            return this._startGameServer().then(() => {
                console.log("game server started");
                return this._loadHeader().then(() => {
                    return this._loadGame().then(resolve);
                });
            });
        });
    }

    // This task is for starting the game server based on game URL
    private _startGameServer(): Promise<void> {
        return new Promise<void>((resolve) => {
            // We don't know the game URL
            if (this._options.url === undefined) {
                return resolve();
            }

            const fileServer = createFileServer(
                this._config,
                this._options.url as string
            );
            this._gameServer = new GameServer(fileServer);
            this._gameServer.ready(resolve);
        });
    }

    // This task is for loading the header.yml file
    private _loadHeader(): Promise<void> {
        return new Promise<MoroboxAIGameSDK.GameHeader>(async (resolve) => {
            const options = {
                url: this._options.url,
                header: this._options.header
            };

            await this._pluginDriver.hookReduceArg0(
                "loadHeader",
                [options],
                (options, result, plugin) => {
                    if (result !== null) {
                        options.header = result;
                    }
                    return options;
                }
            );

            if (options.header === undefined) {
                throw "could not load header";
            }

            return resolve(options.header);
        }).then((header) => {
            console.log("header loaded", header);
            this._options.header = header;
        });
    }

    private _getBootFunction(data: string) {
        let _exports: any = {};
        let _module = { exports: { boot: undefined } };
        const result = new Function("exports", "module", "define", data)(
            _exports,
            _module,
            undefined
        );
        if (_exports.boot !== undefined) {
            this._exports.boot = _exports.boot;
            return;
        }

        if (_module.exports.boot !== undefined) {
            this._exports.boot = _module.exports.boot;
            return;
        }

        if (result === "object" && result.boot !== undefined) {
            this._exports.boot = result.boot;
            return;
        }
    }

    private _loadBoot(): Promise<void> {
        console.log("load boot...");
        return new Promise<void>((resolve, reject) => {
            const boot = this.header!.boot;
            if (boot !== undefined) {
                if (typeof boot === "function") {
                    this._exports.boot = boot;
                    return resolve();
                }

                if (!boot.endsWith(".js") && !boot.endsWith(".ts")) {
                    // boot is not a js file, maybe a module
                    const m = (window as any)[boot];
                    if (m === undefined || m.boot === undefined) {
                        return reject("invalid boot module");
                    }

                    this._exports.boot = m.boot;

                    return resolve();
                }

                if (boot.startsWith("http")) {
                    // direct URL
                    return fetch(boot)
                        .then((res) => {
                            if (!res.ok) {
                                throw new Error(res.statusText);
                            }

                            return res.text();
                        })
                        .then((data) => {
                            this._getBootFunction(data);

                            return resolve();
                        });
                }

                // load boot from a file with the game server
                if (this._gameServer !== undefined) {
                    return this._gameServer.get(boot).then((data) => {
                        this._getBootFunction(data);

                        return resolve();
                    });
                }
            }

            return reject("failed to load boot");
        });
    }

    private _loadGame(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._loadBoot().then(() => {
                if (this._exports.boot === undefined) {
                    return reject("missing boot");
                }

                console.log("boot loaded");
                this._exports.boot(this._proxy).then((game) => {
                    this._game = game;
                    this._game.ticker = this._tickFromGame;
                    console.log("game booted", game);

                    return resolve();
                });
            });
        });
    }

    private _notifyReady(): void {
        this._playTask = undefined;
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    private _play(
        url?: string,
        header?: MoroboxAIGameSDK.GameHeader,
        autoPlay?: boolean
    ): void {
        if (url !== undefined) {
            // Changing the URL, or header, stops the game
            this.stop();

            this._options.url = url;
            this._options.header = header;

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

        if (this._state !== EPlayerState.Idle) return;

        this._state = EPlayerState.Loading;
        this._startLoadingDate = new Date();

        if (this._ui.overlay) {
            this._ui.overlay.loading();
        }

        this._playTask = this._initGame()
            .then(() => {
                this._ready();
            })
            .catch((reason) => {
                console.error(reason);
                this._ready();
            });
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

    // IPlayer interface
    get root(): HTMLElement {
        return this._ui.base as HTMLElement;
    }

    get gameServer(): MoroboxAIGameSDK.IGameServer {
        return this._gameServer as MoroboxAIGameSDK.IGameServer;
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

    controller(id: number): IController | undefined {
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

    get header(): MoroboxAIGameSDK.GameHeader | undefined {
        return this._options.header;
    }

    set header(value: MoroboxAIGameSDK.GameHeader | undefined) {
        this.play({ header: value });
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
    play(options: {
        url?: string;
        header?: MoroboxAIGameSDK.GameHeader;
        autoPlay?: boolean;
    }): void;
    play(
        options?:
            | string
            | {
                  url?: string;
                  header?: MoroboxAIGameSDK.GameHeader;
                  autoPlay?: boolean;
              }
    ): void {
        if (typeof options === "object") {
            this._play(options.url, options.header, options.autoPlay);
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

    getController(controllerId: number): IController | undefined {
        return this._controllerBus.get(controllerId);
    }
}

/**
 * Gets default configured player options.
 * @returns {IPlayerOptions} Default options
 */
export function defaultOptions(): IPlayerOptions {
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
    _: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>
): _ is Element[] | HTMLCollectionOf<Element> {
    return "length" in _;
}

function isPlayerOptions(
    _?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>
): _ is IPlayerOptions {
    return _ !== undefined && !isElementArray(_) && !("className" in _);
}

function createPlayer(
    config: ISDKConfig,
    element: Element,
    options: IPlayerOptions
): IPlayer {
    return new Player(config, element, options);
}

export function init(config: ISDKConfig): IPlayer | IPlayer[];
export function init(
    config: ISDKConfig,
    options: IPlayerOptions
): IPlayer | IPlayer[];
export function init(config: ISDKConfig, element: Element): IPlayer;
export function init(
    config: ISDKConfig,
    element: Element[] | HTMLCollectionOf<Element>
): IPlayer[];
export function init(
    config: ISDKConfig,
    element: Element,
    options: IPlayerOptions
): IPlayer;
export function init(
    config: ISDKConfig,
    element: Element[] | HTMLCollectionOf<Element>,
    options: IPlayerOptions
): IPlayer[];
export function init(
    config: ISDKConfig,
    element?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>,
    options?: IPlayerOptions
): IPlayer | IPlayer[];

/**
 * Initialize player on one or multiple HTML elements.
 * @param {HTMLElement} element Element to wrap
 * @param {IPlayerOptions} options Options for initializing the player
 */
export function init(
    config: ISDKConfig,
    element?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>,
    options?: IPlayerOptions
): IPlayer | IPlayer[] {
    let _elements: undefined | Element | Element[] | HTMLCollectionOf<Element> =
        undefined;
    let _options: IPlayerOptions = defaultOptions();

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

    set url(val: string) {
        this._players.forEach((other) => (other.url = val));
    }

    get header(): MoroboxAIGameSDK.GameHeader | undefined {
        return this.masterPlayer!.header;
    }

    set header(val: MoroboxAIGameSDK.GameHeader | undefined) {
        this._players.forEach((other) => (other.header = val));
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
                  url?: string;
                  header?: MoroboxAIGameSDK.GameHeader;
                  autoPlay?: boolean;
              }
    ): void {
        var _options: {
            url?: string;
            header?: MoroboxAIGameSDK.GameHeader;
            autoPlay?: boolean;
        } = { url: undefined, header: undefined, autoPlay: true };
        if (options === undefined) {
        } else if (typeof options === "string") {
            _options.url = options;
        } else {
            _options.url = options.url;
            _options.header = options.header;
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

    getController(controllerId: number): IController | undefined {
        return undefined;
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
}
