import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import {GameServer} from './server';

/**
 * Version of the SDK.
 */
export const VERSION: string = '0.1.0-alpha.1';

export interface ISDKConfig {
    fileServer: (baseUrl: string) => MoroboxAIGameSDK.IFileServer;
    zipServer: (baseUrl: string) => MoroboxAIGameSDK.IFileServer;
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
    url?: string
}

export interface IMoroboxAIPlayer {
    ready(callback?: () => void): void;
    play(): void;
    pause(): void;
    remove(): void;
}

// Player instance for controlling the game
class MoroboxAIPlayer implements IMoroboxAIPlayer, MoroboxAIGameSDK.BootOptions {
    private _config: ISDKConfig;
    private _ui: {
        element?: HTMLElement;
        canvas?: HTMLCanvasElement;
    } = {};
    private _options: IPlayerOptions;
    private _readyCallback?: () => void;
    private _isReady: boolean = false;
    private _playTask?: Promise<void>;
    private _gameServer?: MoroboxAIGameSDK.IGameServer;
    private _header?: MoroboxAIGameSDK.GameHeader;
    private _exports: {
        boot?: (options: MoroboxAIGameSDK.BootOptions) => MoroboxAIGameSDK.IGame
    } = {};
    private _game?: MoroboxAIGameSDK.IGame;

    constructor(config: ISDKConfig, element: Element, options: IPlayerOptions) {
        this._config = config;
        this._options = options;

        if (isHTMLElement(element)) {
            this._ui.element = element as HTMLElement;
            this._options = {...options};
    
            if (this._options.url === undefined) {
                this._options.url = element.dataset.url;
            }

            this._attach();
        }
    }

    private _attach() {
        if (this._ui.element === undefined) {
            return;
        }

        this._ui.canvas = document.createElement('canvas');
        this._ui.canvas.style.width = '256px';
        this._ui.canvas.style.height = '256px';
        this._ui.element.appendChild(this._ui.canvas);
    }

    // This task is for loading the game
    private _initGame(): Promise<void> {
        return new Promise<void>(() => {
            if (this._ui.element === undefined) {
                return Promise.reject('element is not an HTMLElement');
            }
            
            console.log('start game server...')
            return this._startGameServer().then(() => {
                console.log('game server started');
                return this._loadHeader().then(() => {
                    return this._loadGame();
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
        });  
    }

    ready(callback?: () => void): void {
        this._readyCallback = callback;
        if (this._isReady) {
            this._notifyReady();
        }
    }

    private _notifyReady(): void {
        console.log('ready');
        this._playTask = undefined;
        this._isReady = true;
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    play(): void {
        console.log("play");
        this._playTask = this._initGame().then(() => {
            this._notifyReady();
        }).catch(reason => {
            console.error(reason);
            this._notifyReady();
        });
    }

    pause(): void {
        if (!this._isReady) {
            return;
        }
    }

    remove(): void {
        if (this._ui.canvas !== undefined) {
            this._ui.canvas.remove();
            this._ui.canvas = undefined;
        }
    }
    
    // BootOptions interface
    get root(): HTMLElement {
        return this._ui.canvas as HTMLElement;
    }

    get gameServer(): MoroboxAIGameSDK.IGameServer {
        return this._gameServer as MoroboxAIGameSDK.IGameServer;
    }
}

/**
 * Gets default configured player options.
 * @returns {IPlayerOptions} Default options
 */
export function defaultOptions(): IPlayerOptions {
    return {};
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

function createPlayer(config: ISDKConfig, element: Element, options: IPlayerOptions): IMoroboxAIPlayer {
    return new MoroboxAIPlayer(config, element, options);
}

export function init(config: ISDKConfig) : void;
export function init(config: ISDKConfig, options: IPlayerOptions) : void;
export function init(config: ISDKConfig, element: Element) : IMoroboxAIPlayer;
export function init(config: ISDKConfig, element: Element[] | HTMLCollectionOf<Element>) : IMoroboxAIPlayer[];
export function init(config: ISDKConfig, element: Element, options: IPlayerOptions) : IMoroboxAIPlayer;
export function init(config: ISDKConfig, element: Element[] | HTMLCollectionOf<Element>, options: IPlayerOptions) : IMoroboxAIPlayer[];
export function init(config: ISDKConfig, element?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>, options?: IPlayerOptions) : IMoroboxAIPlayer | IMoroboxAIPlayer[];

/**
 * Initialize player on one or multiple HTML elements.
 * @param {HTMLElement} element Element to wrap
 * @param {IPlayerOptions} options Options for initializing the player
 */
export function init(config: ISDKConfig, element?: IPlayerOptions | Element | Element[] | HTMLCollectionOf<Element>, options?: IPlayerOptions) : IMoroboxAIPlayer | IMoroboxAIPlayer[] {
    let _elements: undefined | Element | Element[] | HTMLCollectionOf<Element> = undefined;
    let _options: IPlayerOptions = defaultOptions();

    if (isPlayerOptions(element)) {
        options = element;
    } else {
        options = undefined;
        _elements = element;
    }

    if (options !== undefined) {
        _options = {..._options, ...options};
    }

    if (_elements == undefined) {
        _elements = document.getElementsByClassName("moroboxai-player");
    }

    if (!isElementArray(_elements)) {
        return createPlayer(config, _elements, _options);
    }

    return Array.prototype.map.call(_elements, _ => createPlayer(config, _, _options)) as IMoroboxAIPlayer[];
}
