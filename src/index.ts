import type { IFileServer } from "moroboxai-game-sdk";
export type {
    LoadAgentOptions,
    IInputController,
    IController
} from "@/controller";
import { Player } from "@/player";
import type { SDKConfig, IPlayer, PlayerOptions } from "@/player";
export type * from "@/player/types";
export * from "@/plugin";

/**
 * Version of the game SDK.
 */
export { VERSION as GAME_SDK_VERSION } from "moroboxai-game-sdk";

/**
 * Version of the SDK.
 */
export const VERSION: string = "__VERSION__";
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
    fileServer: IFileServer;
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
    config: SDKConfig,
    element: Element,
    options: PlayerOptions
): IPlayer {
    return new Player(config, element, options);
}

export function init(config: SDKConfig): IPlayer | IPlayer[];
export function init(
    config: SDKConfig,
    options: PlayerOptions
): IPlayer | IPlayer[];
export function init(config: SDKConfig, element: Element): IPlayer;
export function init(
    config: SDKConfig,
    element: Element[] | HTMLCollectionOf<Element>
): IPlayer[];
export function init(
    config: SDKConfig,
    element: Element,
    options: PlayerOptions
): IPlayer;
export function init(
    config: SDKConfig,
    element: Element[] | HTMLCollectionOf<Element>,
    options: PlayerOptions
): IPlayer[];
export function init(
    config: SDKConfig,
    element?: PlayerOptions | Element | Element[] | HTMLCollectionOf<Element>,
    options?: PlayerOptions
): IPlayer | IPlayer[];

/**
 * Initialize player on one or multiple HTML elements.
 * @param {HTMLElement} element Element to wrap
 * @param {PlayerOptions} options Options for initializing the player
 */
export function init(
    config: SDKConfig,
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
