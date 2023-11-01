import type { Controller as ControllerState } from "moroboxai-game-sdk";
import type { Inputs } from "moroboxai-game-sdk";
import type { IInputDevice, ControllerSaveState, IController } from "./types";
import type { IAgent } from "@agent/types";

/**
 * Options for the Controller.
 */
export interface ControllerOptions {
    // Unique id of the controller
    id: number;
    /**
     * Input device bound to the controller.
     *
     * It can be undefined if the controller is planned to be used only
     * by agents.
     */
    inputDevice?: IInputDevice;
    // Agent bound to this controller
    agent?: IAgent;
}

// Allow to smoothly load and unload AI code to override inputs
export class Controller implements IController {
    // Unique identifier
    private _id: number;
    // Input device bound to this controller
    private _inputDevice?: IInputDevice;
    // Agent bound to this controller
    private _agent?: IAgent;

    constructor(options: ControllerOptions) {
        this._id = options.id;
        this._inputDevice = options.inputDevice;
        this._agent = options.agent;
    }

    get id(): number {
        return this._id;
    }

    get label(): string {
        if (this._agent !== undefined) {
            return this._agent.label;
        }

        if (this._inputDevice !== undefined) {
            return "human";
        }

        return "<>";
    }

    get isBound(): boolean {
        return this._inputDevice !== undefined;
    }

    get isAgent(): boolean {
        return this._agent !== undefined;
    }

    get isPlayer(): boolean {
        return this.isBound && !this.isAgent;
    }

    set agent(value: IAgent | undefined) {
        this._agent = value;
    }

    get agent(): IAgent | undefined {
        return this._agent;
    }

    inputs(state: object): Inputs {
        if (this._agent !== undefined) {
            return this._agent.inputs(state);
        }

        if (this._inputDevice !== undefined) {
            return this._inputDevice.inputs;
        }

        return {};
    }

    saveState(): ControllerSaveState {
        return this._agent?.saveState() ?? {};
    }

    loadState(state: ControllerSaveState) {
        this._agent?.loadState(state);
    }
}

/**
 * Options for the ControllerBus.
 */
export interface ControllerBusOptions {
    // List of controllers
    controllers: IController[];
}

// Aggregate multiple controllers
export class ControllerBus {
    // Connected controllers
    private _controllers: Map<number, IController> = new Map();
    private _controllersArray: IController[];

    constructor(options: ControllerBusOptions) {
        this._controllersArray = [...options.controllers];
        this._controllersArray.forEach((controller) => {
            this._controllers.set(controller.id, controller);
        });
    }

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    get controllers(): Map<number, IController> {
        return this._controllers;
    }

    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    get(controllerId: number): IController | undefined {
        return this._controllers.get(controllerId);
    }

    inputs(state: object): ControllerState[] {
        return this._controllersArray.map((controller) => ({
            label: controller.label,
            isBound: controller.isBound,
            isPlayer: controller.isPlayer,
            isAgent: controller.isAgent,
            inputs: controller.inputs(state)
        }));
    }

    saveState(): ControllerSaveState[] {
        return this._controllersArray.map((controller) =>
            controller.saveState()
        );
    }

    loadState(state: ControllerSaveState[]) {
        state.forEach((controller, index) => {
            this._controllersArray[index].loadState(controller);
        });
    }
}
