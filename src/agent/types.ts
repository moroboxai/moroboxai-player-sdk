import { Inputs } from "moroboxai-game-sdk";

/**
 * API exposed by Moroxel8AI for the agents.
 */
export interface IAPI {
    require(value: string): any;
}

/**
 * Options to initialize an agent.
 */
export interface InitAgentOptions {
    // Base URL of the script
    baseUrl: string;
    // Script
    script: string;
    // API for the agent
    api: IAPI;
}

export interface LanguageConfig {
    // Possible script extensions
    readonly extensions: string[];
    // Main file
    readonly main: string;
    // Initialize an agent
    init(options: InitAgentOptions): IAgent | undefined;
}

/**
 * Supported languages for agents.
 */
export type AgentLanguage = "javascript" | "lua";

/**
 * Save state for the agent.
 */
export interface AgentSaveState {
    [key: string]: any;
}

/**
 * Interface for the agent once loaded.
 */
export interface IAgent {
    // Displayed label
    readonly label: string;
    // Save the state of the agent
    saveState(): AgentSaveState;
    // Load the state of the agent
    loadState(state: AgentSaveState): void;
    // Get inputs for the current frame
    inputs(state: object): Inputs;
}
