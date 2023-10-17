import type {
    GameHeader,
    BootLike,
    IFileServer,
    GameSaveState
} from "moroboxai-game-sdk";
import type {
    LoadAgentOptions,
    IController,
    IInputController,
    ControllerSaveState
} from "@/controller";
import type { Plugin } from "@/plugin";

export interface ISDKConfig {
    // Create a controller listening for player inputs
    inputController: () => IInputController;
    // Create a file server for a given URL
    fileServer: (baseUrl: string) => IFileServer;
    // Create a zip server for a given URL
    zipServer: (zipUrl: string) => IFileServer;
}

// Possible options for initializing the player
export interface PlayerOptions {
    element?: Element | Element[] | HTMLCollectionOf<Element>;
    /**
     * Base URL of the game or URL of the header file.
     *
     * The URL is always required because this is where the header,
     * scripts, and assets of the game are served from.
     */
    url: string;
    /**
     * Override the boot defined in the header.
     *
     * This can be used in development mode to pass the boot from code.
     */
    boot?: BootLike;
    splashart?: string;
    // Player size
    width?: number | string;
    height?: number | string;
    // Scale of the player based on native size of the game
    scale?: number;
    resizable?: boolean;
    // Play the game after init
    autoPlay?: boolean;
    // Desired game speed
    speed?: number;
    // Simulated or not
    simulated?: boolean;
    // List of agents
    agents?: Array<LoadAgentOptions>;
    // List of plugins
    plugins?: Plugin[];
    onReady?: () => void;
}

export type PlayerSaveState = GameSaveState & {
    physicsAccumulator: number;
    game?: GameSaveState;
    controllers: ControllerSaveState[];
};

export interface IPlayer {
    // Get/Set the game speed
    speed: number;
    // Get/Set the player's width
    width: number;
    // Get/Set the player's height
    height: number;
    // Get/Set the scale of player
    scale: number;
    // Get/Set if the player is resizable
    resizable: boolean;
    // Native width of the game
    readonly gameWidth?: number;
    // Native height of the game
    readonly gameHeight?: number;
    // Scale of the game
    readonly gameScale?: number;
    // Aspect ratio of the game
    readonly gameAspectRatio?: string;
    // Base URL of the game
    readonly url: string;
    // Get/Set the boot
    boot?: BootLike;
    // Header of the game
    readonly header: GameHeader | undefined;
    // Get/Set weither to game should play automatically
    autoPlay: boolean;
    // Simulated or not
    simulated: boolean;
    // Hook called by the player when ticked
    ticker?: (delta: number) => void;
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
        // New game URL
        url: string;
        // Bypass the default autoPlay value
        autoPlay?: boolean;
    }): void;

    // Called when the game starts playing
    onReady?: () => void;

    // Pause the game
    pause(): void;

    // Stop the game
    stop(): void;

    /**
     * Save the state of the player.
     */
    saveState(): PlayerSaveState;

    /**
     * Load the state of the player.
     */
    loadState(state?: PlayerSaveState): void;

    /**
     * Tick the player.
     * @param {number} delta - elapsed time
     */
    tick(delta: number): void;

    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    getController(controllerId: number): IController | undefined;

    // Remove the player from document
    remove(): void;

    // Resize the player
    resize(options: {
        width?: number | string;
        height?: number | string;
    }): void;
    resize(width: number | string, height: number | string): void;
}

export interface IMetaPlayer extends IPlayer {
    // Add a player to the list
    addPlayer(other: IPlayer): void;

    // Remove a player from the list
    removePlayer(other: IPlayer): void;
}
