import type { Inputs } from "moroboxai-game-sdk";
import type { IAgent } from "@agent/types";

/**
 * Interface for the keyboard or gamepad.
 */
export interface IInputDevice {
    // Pressed inputs
    inputs: Inputs;
}

/**
 * Save state for the controller.
 */
export interface ControllerSaveState {
    [key: string]: any;
}

/**
 * Interface for a player or agent controller.
 */
export interface IController {
    // Unique id of the controller
    readonly id: number;
    // Displayed label
    readonly label: string;
    // If the controller is bound to an input device or agent
    readonly isBound: boolean;
    // If the controller is bound to an agent
    readonly isAgent: boolean;
    // If the controller is bound to an input device
    readonly isPlayer: boolean;
    // Get/Set the agent.
    agent?: IAgent;

    /**
     * Get inputs based on game state.
     * @param {object} state - game state
     * @returns {Inputs} Inputs
     */
    inputs(state: object): Inputs;

    /**
     * Return the state of the controller.
     */
    saveState(): ControllerSaveState;

    /**
     * Load the state of the controller.
     * @param {ControllerSaveState} state - controller state
     */
    loadState(state: ControllerSaveState): void;
}
