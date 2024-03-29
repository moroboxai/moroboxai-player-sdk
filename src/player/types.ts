import type {
    GameHeader,
    BootLike,
    IFileServer,
    GameSaveState
} from "moroboxai-game-sdk";
import type {
    IController,
    IInputDevice,
    ControllerSaveState
} from "@controller/types";
import type { Plugin } from "@/plugin";
import type { AgentLanguage, IAgent } from "@/agent/types";

/**
 * Possible stretch modes for the player.
 *
 * fill: the player is configured to take 100% width and height.
 * fixed: the player is set to the size of the game.
 */
export type StretchMode = "fill" | "fixed";

// Return a new IInputDevice
export interface InputDeviceFactory {
    (): IInputDevice;
}

// Return a new IFileServer for an URL
export interface FileServerFactory {
    (baseUrl: string): IFileServer;
}

export interface SDKConfig {
    // Create a device listening for player inputs
    inputDeviceFactory: InputDeviceFactory;
    // Create a file server for a given URL
    fileServerFactory: FileServerFactory;
}

/**
 * Options for loading an agent.
 */
export type LoadAgentOptions = {
    // Language of the script
    language?: AgentLanguage;
} & (
    | {
          // URL where to find the script
          url: string;
          script?: never;
      }
    | {
          url?: never;
          // Direct script of the agent
          script: string;
      }
);

export type AgentLike = LoadAgentOptions | IAgent;

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
    // How the player adapt its size
    stretchMode?: StretchMode;
    resizable?: boolean;
    // Play the game after init
    autoPlay?: boolean;
    // Desired game speed
    speed?: number;
    // Simulated or not
    simulated?: boolean;
    // List of agents
    agents?: AgentLike | AgentLike[];
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
    // How the player adapt its size
    stretchMode: StretchMode;
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
     * @param {number} controllerId - controller id
     * @returns {IController} Controller
     */
    getController(controllerId: number): IController | undefined;

    /**
     * Load an agent to a controller.
     * @param {number} controllerId - controller id
     * @param {AgentLike} options - options
     */
    loadAgent(controllerId: number, options: AgentLike): Promise<void>;

    /**
     * Unload an agent from a controller.
     * @param {number} controllerId - controller id
     */
    unloadAgent(controllerId: number): void;

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
