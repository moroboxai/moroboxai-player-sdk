import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import {ControllerBus, IMoroboxAIController} from './controller';
import {GameServer} from './server';

/**
 * Version of the SDK.
 */
export const VERSION: string = '0.1.0-alpha.3';

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
    element?: Element | Element[] | HTMLCollectionOf<Element>,
    url?: string,
    splashart?: string,
    width?: string,
    height?: string,
    autoPlay?: boolean,
    onReady?: () => void
}

export interface IMoroboxAIPlayer {
    // Play the game
    play(): void;
    onReady?: () => void;
    pause(): void;
    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IMoroboxAIController} Controller
     */
    controller(controllerId: number): IMoroboxAIController | undefined;
    // Remove the player from document
    remove(): void;
}

// Player instance for controlling the game
class MoroboxAIPlayer implements IMoroboxAIPlayer, MoroboxAIGameSDK.IPlayer {
    private _config: ISDKConfig;
    private _ui: {
        element?: HTMLElement;
        wrapper?: HTMLElement;
        base?: HTMLElement;
        overlay?: HTMLElement;
        playButton?: HTMLElement;
    } = {};
    private _options: IPlayerOptions;
    private _readyCallback?: () => void;
    private _isReady: boolean = false;
    private _playTask?: Promise<void>;
    private _gameServer?: MoroboxAIGameSDK.IGameServer;
    private _header?: MoroboxAIGameSDK.GameHeader;
    private _exports: {
        boot?: (player: MoroboxAIGameSDK.IPlayer) => MoroboxAIGameSDK.IGame
    } = {};
    private _game?: MoroboxAIGameSDK.IGame;
    private _controllerBus: ControllerBus = new ControllerBus();

    constructor(config: ISDKConfig, element: Element, options: IPlayerOptions) {
        this._config = config;
        this._options = options;

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

        {
            let div = document.createElement('div');
            this._ui.overlay = div;
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.position = 'absolute';
            div.style.left = '0';
            div.style.top = '0';
            div.style.display = 'flex';
            div.style.flexDirection = 'column';
            div.style.justifyContent = 'center';
            div.style.alignItems = 'center';
            this._ui.wrapper.appendChild(div);

            {
                let input = document.createElement('input');
                this._ui.playButton = input;
                input.type = 'button';
                input.value = 'Play';
                input.onclick = () => this._play();
                div.appendChild(input);
            }
        }
        /*this._ui.canvas = document.createElement('canvas');
        this._ui.canvas.style.width = '256px';
        this._ui.canvas.style.height = '256px';
        this._ui.element.appendChild(this._ui.canvas);*/
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
        this._isReady = true;
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }

    private _play(): void {
        if (this._ui.playButton !== undefined) {
            this._ui.playButton.style.display = 'none';
        }

        this._playTask = this._initGame().catch(reason => {
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
        if (this._ui.wrapper !== undefined) {
            this._ui.wrapper.remove();
            this._ui.wrapper = undefined;
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
        this._ui.wrapper!.style.width = `${width}px`;
        this._ui.wrapper!.style.height = `${height}px`;
    }

    get onReady(): (() => void) | undefined {
        return this._readyCallback;
    }

    set onReady(callback: (() => void) | undefined) {
        this._readyCallback = callback;
        if (this._isReady) {
            this._notifyReady();
        }
    }

    ready(): void {
        console.log('game is loaded and ready');
        this._notifyReady();
    }
    
    sendState(state: any, controllerId?: number): void {
        this._controllerBus.sendState(state, controllerId);
    }
    
    controller(id: number): IMoroboxAIController | undefined {
        return this._controllerBus.get(id);
    }

    // IMoroboxAIPlayer interface
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
        height: "100%"
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

function createPlayer(config: ISDKConfig, element: Element, options: IPlayerOptions): IMoroboxAIPlayer {
    return new MoroboxAIPlayer(config, element, options);
}

export function init(config: ISDKConfig) : IMoroboxAIPlayer | IMoroboxAIPlayer[];
export function init(config: ISDKConfig, options: IPlayerOptions) : IMoroboxAIPlayer | IMoroboxAIPlayer[];
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

    return Array.prototype.map.call(_elements, _ => createPlayer(config, _, _options)) as IMoroboxAIPlayer[];
}
