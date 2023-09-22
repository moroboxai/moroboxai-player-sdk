import * as MoroboxAIGameSDK from "moroboxai-game-sdk";

export interface IVM {
    // Save the state of the agent
    saveState(): object;
    // Load the state of the agent
    loadState(state: object): void;
    // Get inputs for the current frame
    inputs(state: object): MoroboxAIGameSDK.IInputs;
}

export const AGENT_FUNCTIONS = ["saveState", "loadState", "inputs"];
