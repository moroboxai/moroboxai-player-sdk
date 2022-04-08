import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import {GameServer} from './server';

/**
 * Version of the SDK.
 */
export const VERSION: string = '0.1.0-alpha.1';

export interface ISDKConfig {
    createFileServer: (baseUrl: string) =>  MoroboxAIGameSDK.IFileServer
}

// Possible options for initializing the player
export interface IPlayerOptions {
    url?: string
}

export interface IMoroboxAIPlayer {
    pause(): void;
}

class MoroboxAIPlayer implements IMoroboxAIPlayer {
    pause(): void {

    }
}

/**
 * Gets default configured player options.
 * @returns {IPlayerOptions} Default options
 */
export function defaultOptions(): IPlayerOptions {
    return {};
}

export abstract class GameSDKBase implements MoroboxAIGameSDK.IMoroboxAIGameSDK {
    private _readyCallback?: () => void;
    private _isReady: boolean = false;
    private _fileServer: MoroboxAIGameSDK.IFileServer;

    public get version(): string {
        return VERSION;
    }

    public get fileServer(): MoroboxAIGameSDK.IFileServer {
        return this._fileServer;
    }

    constructor(options: GameSDKOptions) {
        this._fileServer = options.fileServer;
        // be ready when both servers are ready
        Promise.all([
            new Promise<void>((resolve, _) => {
                this._fileServer.ready(resolve);
            })
        ]).then(() => this._notifyReady());
    }

    public ready(callback: () => void): void {
        this._readyCallback = callback;
        if (this._isReady) {
            callback();
        }
    }

    private _notifyReady(): void {
        this._isReady = true;
        if (this._readyCallback !== undefined) {
            this._readyCallback();
        }
    }
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

function initInternal(config: ISDKConfig, element: Element, options: IPlayerOptions): IMoroboxAIPlayer {
    if (!isHTMLElement(element)) {
        return new MoroboxAIPlayer();
    }

    const _options = {...options};

    if (_options.url === undefined) {
        _options.url = element.dataset.url;
    }

    const fileServer = config.createFileServer(_options.url as string);
    const gameServer = new GameServer(fileServer);
    gameServer.ready(() => {
        gameServer.gameHeader().then(header => {
            console.log(header);
        });
    });
    return new MoroboxAIPlayer();
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
        return initInternal(config, _elements, _options);
    }

    return Array.prototype.map.call(_elements, _ => initInternal(config, _, _options)) as IMoroboxAIPlayer[];
}
