import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import {ControllerBus, IInputController, IController} from './controller';
import {Overlay} from './overlay';
import {GameServer} from './server';

export {Inputs, IInputController, IController} from './controller';

/**
 * Version of the SDK.
 */
export const VERSION: string = '0.1.0-alpha.10';

// Force displaying the loading screen for x seconds
const FORCE_LOADING_TIME = 1000;

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
function createFileServer(sdkConfig: ISDKConfig, baseUrl: string): MoroboxAIGameSDK.IFileServer {
    // Point to zip file
    if (baseUrl.endsWith(".zip")) {
        return sdkConfig.zipServer(baseUrl);
    }
    
    // Point to header.yml so take parent URL
    if (baseUrl.endsWith(".yaml") || baseUrl.endsWith(".yml")) {
        const pos = baseUrl.lastIndexOf('/');
        baseUrl = pos < 0 ? '' : baseUrl.substring(0, pos);
    }

    return sdkConfig.fileServer(baseUrl);
}

// Possible options for initializing the player
export interface IPlayerOptions {
    element?: Element | Element[] | HTMLCollectionOf<Element>;
    // URL where to find the game header
    url?: string;
    // Direct game header
    header?: MoroboxAIGameSDK.GameHeader;
    splashart?: string;
    // Player size in pixels
    width?: number;
    height?: number;
    resizable?: boolean;
    // Play the game after init
    autoPlay?: boolean;
    // Desired game speed
    speed?: number;
    onReady?: () => void;
}

export interface IPlayer {
    // Get/Set the game speed
    speed: number;
    // Get/Set the player's width
    width: number;
    // Get/Set the player's height
    height: number;
    // If the player is loading the game
    readonly isLoading: boolean;
    // If the game has been loaded and is playing
    readonly isPlaying: boolean;
    // If the game has been paused
    readonly isPaused: boolean;

    // Play the game as configured during init
    play(): void;

    // Play the game from URL
    play(url: string): void;

    // Play the game from URL or header
    play(options: {
        url?: string,
        header?: MoroboxAIGameSDK.GameHeader
    }): void;

    // Called when the game starts playing
    onReady?: () => void;

    // Pause the game
    pause(): void;

    // Stop the game
    stop(): void;

    // Reload the game
    reload(): void;

    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    controller(controllerId: number): IController | undefined;

    // Remove the player from document
    remove(): void;

    // Resize the player
    resize(options: {width?: number, height?: number}): void;
    resize(width: number, height: number): void;
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
        this.resize({width: value});
    }

    get height(): number {
        return this._player.height;
    }

    set height(value: number) {
        this.resize({height: value});
    }

    get isResizable(): boolean {
        return this._player.isResizable;
    }

    get speed(): number {
        return this._player.speed;
    }

    get header(): MoroboxAIGameSDK.GameHeader {
        return this._player.header;
    }

    resize(width: {width?: number, height?: number} | number, height?: number): void {
        if (!this.isResizable) return;

        if (typeof width === 'object') {
            this._player.resize(width);
        } else {
            this._player.resize(width, height!);
        }
    }

    ready(): void {
        this._player.ready();
    }

    sendState(state: any, controllerId?: number | undefined): void {
        this._player.sendState(state, controllerId);
    }

    controller(controllerId: number): MoroboxAIGameSDK.IController | undefined {
        return this._player.controller(controllerId);
    }
}

// Player instance for controlling the game
class Player implements IPlayer, MoroboxAIGameSDK.IPlayer {
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
    private _readyCallback?: () => void;
    private _playTask?: Promise<void>;
    private _startLoadingDate?: Date;
    private _gameServer?: MoroboxAIGameSDK.IGameServer;
    private _header?: MoroboxAIGameSDK.GameHeader;
    private _exports: {
        boot?: (player: MoroboxAIGameSDK.IPlayer) => MoroboxAIGameSDK.IGame
    } = {};
    private _game?: MoroboxAIGameSDK.IGame;
    private _controllerBus: ControllerBus;
    private _resizeListener?: () => void;
    private _speed: number = 1;

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
        this._controllerBus = new ControllerBus({
            inputController: config.inputController
        });

        if (this._options.onReady !== undefined) {
            this._readyCallback = this._options.onReady;
        }

        if (isHTMLElement(element)) {
            this._ui.element = element as HTMLElement;
            this._options = {...options};
    
            if (this._options.url === undefined && element.dataset.url !== undefined) {
                this._options.url = element.dataset.url;
            }

            this._attach();

            if (this._options.autoPlay) {
                this.play();
            }
        }
    }

    private _attach() {
        if (this._ui.element === undefined) {
            return;
        }

        {
            let div = document.createElement('div');
            this._ui.wrapper = div;
            div.addEventListener('mouseenter', () => this._onMouseEnter());
            div.addEventListener('mousemove', () => this._onMouseMove());
            div.addEventListener('mouseleave', () => this._onMouseLeave());
            div.style.position = 'relative';
            div.style.backgroundSize = 'cover';

            if (this._options.splashart !== undefined) {
                div.style.backgroundImage = `url('${this._options.splashart}')`;
            }

            this._ui.element.appendChild(div);
        }

        {
            let div = document.createElement('div');
            this._ui.base = div;
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.position = 'absolute';
            div.style.left = '0';
            div.style.top = '0';
            this._ui.wrapper.appendChild(div);
        }

        this.resize({width: this._options.width, height: this._options.height});

        this._ui.overlay = new Overlay(this._ui.wrapper);
        this._ui.overlay.onPlay = () => this.play();
        this._ui.overlay.onSpeed = (value: number) => this.speed = value;

        this._resizeListener = () => this._onResize();
        window.addEventListener('resize', this._resizeListener);
    }

    // This task is for loading the game
    private _initGame(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this._ui.element === undefined) {
                return reject('element is not an HTMLElement');
            }
            
            console.log('start game server...')
            return this._startGameServer().then(() => {
                console.log('game server started');
                return this._loadHeader().then(() => {
                    return this._loadGame().then(resolve);
                });
            })
        });
    }

    // This task is for starting the game server based on game URL
    private _startGameServer(): Promise<void> {
        return new Promise<void>(resolve => {
            // We don't know the game URL
            if (this._options.url === undefined) {
                return resolve();
            }

            const fileServer = createFileServer(this._config, this._options.url as string);
            this._gameServer = new GameServer(fileServer);
            this._gameServer.ready(resolve);
        });
    }

    // This task is for loading the header.yml file
    private _loadHeader(): Promise<void> {
        console.log('load header...');
        return new Promise<MoroboxAIGameSDK.GameHeader>((resolve, reject) => {
            // The header is provided by user
            if (this._options.header !== undefined) {
                return resolve(this._options.header);
            }

            if (this._gameServer === undefined) {
                return reject('failed to get header');
            }

            return this._gameServer.gameHeader().then(resolve);
        }).then(header => {
            console.log('header loaded');
            console.log(header);
            this._header = header;

            this._proxy.resize({width: header.width, height: header.height});
        });
    }

    private _getBootFunction(data: string) {
        let _exports: any = {};
        let _module = {exports: {boot: undefined}};
        const result = (new Function('exports', 'module', 'define', data))(_exports, _module, undefined);
        if (_exports.boot !== undefined) {
            this._exports.boot = _exports.boot;
            return;
        }

        if (_module.exports.boot !== undefined) {
            this._exports.boot = _module.exports.boot;
            return;
        }

        if (result === 'object' && result.boot !== undefined) {
            this._exports.boot = result.boot;
            return;
        }
    }

    private _loadBoot(): Promise<void> {
        console.log('load boot...');
        const boot = this._header!.boot;
        if (boot !== undefined) {
            if (!boot.endsWith('.js')) {
                // boot is not a js file, maybe a module
                return new Promise((resolve, reject) => {
                    const m = (window as any)[boot];
                    if (m === undefined || m.boot === undefined) {
                        return reject('invalid boot module');
                    }

                    this._exports.boot = m.boot;

                    return resolve();
                });
            }

            if (boot.startsWith('http')) {
                // direct URL
                return fetch(this._header?.boot!).then(res => {
                    if (!res.ok) {
                        throw new Error(res.statusText);
                    }
        
                    return res.text();
                }).then(data => {
                    this._getBootFunction(data);
        
                    return Promise.resolve();
                });
            }

            // load boot from a file with the game server
            if (this._gameServer !== undefined) {
                return this._gameServer.get(boot).then(data => {
                    this._getBootFunction(data);

                    return Promise.resolve();
                });
            }
        }

        return new Promise<void>((resolve, reject) => reject('failed to load boot'));
    }

    private _loadGame(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._loadBoot().then(() => {
                if (this._exports.boot === undefined) {
                    return reject('missing boot');
                }

                console.log('boot loaded');
                this._game = this._exports.boot(this._proxy);
                console.log(this._game);

                return resolve();
            });
        });
    }

    private _notifyReady(): void {
        this._playTask = undefined;
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    private _play(url?: string, header?: MoroboxAIGameSDK.GameHeader): void {
        if (url !== undefined || header !== undefined) {
            this.stop();

            this._options.url = url;
            this._options.header = header;
            this._play();
            return;
        }

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

        this._playTask = this._initGame().catch(reason => {
            console.error(reason);
            this._notifyReady();
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
    resize(options: {width?: number, height?: number}): void;
    resize(width?: {width?: number, height?: number} | number, height?: number) {
        if (this._ui.wrapper === undefined) return;

        if (typeof width !== "number") {
            height = width!.height;
            width = width!.width;
        }

        if (width !== undefined) {
            this._ui.wrapper.style.width = `${width}px`;
        } else {
            this._ui.wrapper.style.width = '100%';
        }

        if (height !== undefined) {
            this._ui.wrapper.style.height = `${height}px`;
        } else {
            this._ui.wrapper.style.height = '100%';
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

    private _ready() {
        if (this._state !== EPlayerState.BecomePlaying) {
            return;
        }

        this._state = EPlayerState.Playing;

        if (this._ui.overlay) {
            this._ui.overlay.playing();
        }

        if (this._game) {
            this._game.play();
        }

        this._notifyReady();
    }

    // Called by the game when it's loaded and ready to play
    ready(): void {
        if (this._state != EPlayerState.Loading) {
            return;
        }

        this._state = EPlayerState.BecomePlaying;

        const timeRemaining = FORCE_LOADING_TIME - (+new Date() - +this._startLoadingDate!);
        if (timeRemaining > 0) {
            setTimeout(() => this._ready(), timeRemaining);
            return;
        }

        this._ready();
    }
    
    sendState(state: any, controllerId?: number): void {
        this._controllerBus.sendState(state, controllerId);
    }
    
    controller(id: number): IController | undefined {
        return this._controllerBus.get(id);
    }

    // IPlayer interface
    get speed(): number {
        return this._speed;
    }

    set speed(value: number) {
        this._speed = value;
    }

    get width(): number {
        return this._ui.wrapper ? this._ui.wrapper.clientWidth : 0;
    }

    set width(value: number) {
        this.resize({width: value});
    }

    get height(): number {
        return this._ui.wrapper ? this._ui.wrapper.clientHeight : 0;
    }

    set height(value: number) {
        this.resize({height: value});
    }

    get isResizable(): boolean {
        return this._options.resizable === true;
    }

    get header(): MoroboxAIGameSDK.GameHeader {
        return this._header!;
    }

    play(): void;
    play(url: string): void;
    play(options: {url?: string, header?: MoroboxAIGameSDK.GameHeader}): void;
    play(options?: string | {url?: string, header?: MoroboxAIGameSDK.GameHeader}): void {
        if (typeof options === 'object') {
            this._play(options.url, options.header);
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
            window.removeEventListener('resize', this._resizeListener);
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
}

/**
 * Gets default configured player options.
 * @returns {IPlayerOptions} Default options
 */
export function defaultOptions(): IPlayerOptions {
    return {
        resizable: true,
        speed: 1
    };
}

export interface GameSDKOptions {
    // Local file server
    fileServer: MoroboxAIGameSDK.IFileServer,
}

function isHTMLElement(_: Element | HTMLElement): _ is HTMLElement {
    return "dataset" in _;
}

function isElementArray(_: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>): _ is Element[] | HTMLCollectionOf<Element> {
    return "length" in _;
}

function isPlayerOptions(_?: | IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>): _ is IPlayerOptions {
    return _ !== undefined && !isElementArray(_) && !("className" in _);
}

function createPlayer(config: ISDKConfig, element: Element, options: IPlayerOptions): IPlayer {
    return new Player(config, element, options);
}

export function init(config: ISDKConfig) : IPlayer | IPlayer[];
export function init(config: ISDKConfig, options: IPlayerOptions) : IPlayer | IPlayer[];
export function init(config: ISDKConfig, element: Element) : IPlayer;
export function init(config: ISDKConfig, element: Element[] | HTMLCollectionOf<Element>) : IPlayer[];
export function init(config: ISDKConfig, element: Element, options: IPlayerOptions) : IPlayer;
export function init(config: ISDKConfig, element: Element[] | HTMLCollectionOf<Element>, options: IPlayerOptions) : IPlayer[];
export function init(config: ISDKConfig, element?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>, options?: IPlayerOptions) : IPlayer | IPlayer[];

/**
 * Initialize player on one or multiple HTML elements.
 * @param {HTMLElement} element Element to wrap
 * @param {IPlayerOptions} options Options for initializing the player
 */
export function init(config: ISDKConfig, element?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>, options?: IPlayerOptions) : IPlayer | IPlayer[] {
    let _elements: undefined | Element | Element[] | HTMLCollectionOf<Element> = undefined;
    let _options: IPlayerOptions = defaultOptions();

    if (isPlayerOptions(element)) {
        options = element;
    } else {
        _elements = element;
    }

    if (options !== undefined) {
        _options = {..._options, ...options};
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

    return Array.prototype.map.call(_elements, _ => createPlayer(config, _, _options)) as IPlayer[];
}
