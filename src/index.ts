import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import {ControllerBus, IInputController, IController} from './controller';
import {Overlay} from './overlay';
import {GameServer} from './server';

export {Inputs, IInputController, IController} from './controller';

/**
 * Version of the SDK.
 */
export const VERSION: string = '0.1.0-alpha.4';

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
    
    // Point to header.json so take parent URL
    if (baseUrl.endsWith(".json")) {
        const pos = baseUrl.lastIndexOf('/');
        baseUrl = pos < 0 ? '' : baseUrl.substring(0, pos);
    }

    return sdkConfig.fileServer(baseUrl);
}

// Possible options for initializing the player
export interface IPlayerOptions {
    element?: Element | Element[] | HTMLCollectionOf<Element>,
    url?: string,
    splashart?: string,
    width?: string,
    height?: string,
    // Play the game after init
    autoPlay?: boolean,
    // Desired game speed
    speed?: number,
    onReady?: () => void
}

export interface IPlayer {
    // Get/Set the game speed
    speed: number;
    // Get/Set the player's width
    width: number;
    // Get/Set the player's height
    height: number;
    // If the player is loading the game
    isLoading: boolean;
    // If the game has been loaded and is playing
    isPlaying: boolean;
    // Play the game
    play(): void;
    // Called when the game starts playing
    onReady?: () => void;
    pause(): void;
    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    controller(controllerId: number): IController | undefined;
    // Remove the player from document
    remove(): void;
}

// Internal player state
enum EPlayerState {
    Idle,
    Loading,
    BecomePlaying,
    Playing
}

// Player instance for controlling the game
class MoroboxAIPlayer implements IPlayer, MoroboxAIGameSDK.IPlayer {
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

    get isLoading(): boolean {
        return this._state == EPlayerState.Loading;
    }

    get isPlaying(): boolean {
        return this._state == EPlayerState.Playing;
    }

    constructor(config: ISDKConfig, element: Element, options: IPlayerOptions) {
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
    
            if (this._options.url === undefined) {
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
            div.style.width = this._options.width!;
            div.style.height = this._options.height!;
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

        this._ui.overlay = new Overlay(this._ui.wrapper);
        this._ui.overlay.onPlay = () => this.play();
        this._ui.overlay.onSpeed = (value: number) => this.speed = value;
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
            const fileServer = createFileServer(this._config, this._options.url as string);
            this._gameServer = new GameServer(fileServer);
            this._gameServer.ready(resolve);
        });
    }

    // This task is for loading the header.json file
    private _loadHeader(): Promise<void> {
        console.log('load game header...');
        return this._gameServer!.gameHeader().then((header: MoroboxAIGameSDK.GameHeader) => {
            this._header = header;
            console.log('game header loaded');
            console.log(header);
        });
    }

    private _loadGame(): Promise<void> {
        console.log('load game...');
        return this._gameServer!.get(this._header!.boot).then(data => {
            (new Function('exports', data))(this._exports);
            if (this._exports.boot === undefined) {
                return Promise.reject('missing boot function');
            }

            this._game = this._exports.boot(this);
            console.log(this._game);
            return Promise.resolve();
        });  
    }

    private _notifyReady(): void {
        this._playTask = undefined;
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    private _play(): void {
        if (this._state != EPlayerState.Idle) {
            return;
        }

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

    pause(): void {
        if (!this.isPlaying) {
            return;
        }
    }

    remove(): void {
        if (this._ui.overlay) {
            this._ui.overlay.remove();
            this._ui.overlay = undefined;
        }

        if (this._ui.wrapper) {
            this._ui.wrapper.remove();
            this._ui.wrapper = undefined;
        }
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

    resize(width: number, height: number) {
        if (this._ui.wrapper) {
            this._ui.wrapper.style.width = `${width}px`;
            this._ui.wrapper.style.height = `${height}px`;
        }

        if (this._game && this.isPlaying) {
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
            this._ui.overlay.ready();
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
        if (this._game) {
            return this._game?.speed;
        }

        return 1;
    }

    set speed(value: number) {
        if (this._game) {
            this._game.speed = value;
        }
    }

    get width(): number {
        return this._ui.wrapper ? this._ui.wrapper.clientWidth : 0;
    }

    set width(value: number) {
        this.resize(value, this.height);
    }

    get height(): number {
        return this._ui.wrapper ? this._ui.wrapper.clientHeight : 0;
    }

    set height(value: number) {
        this.resize(this.width, value);
    }

    play(): void {
        this._play();
    }
}

/**
 * Gets default configured player options.
 * @returns {IPlayerOptions} Default options
 */
export function defaultOptions(): IPlayerOptions {
    return {
        width: "100%",
        height: "100%",
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
    return new MoroboxAIPlayer(config, element, options);
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
