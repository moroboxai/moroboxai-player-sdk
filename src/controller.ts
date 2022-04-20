import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';

// The possible inputs for the MoroboxAI
export interface Inputs {
    up?: boolean;
    down?: boolean;
    left?: boolean;
    right?: boolean;
}

// Controller handling keyboard/gamepad inputs
export interface IInputController {
    /**
     * Detach the controller to stop listening for inputs.
     */
    remove(): void;

    /**
     * Return the inputs state.
     * @returns {Inputs} State
     */
    inputs(): Inputs;
}

// Extends MoroboxAIGameSDK.IController features
export interface IController extends MoroboxAIGameSDK.IController {
    /**
     * Load an AI to this controller.
     * @param {string} code - AI code 
     */
    loadAI(code: string): void;

    /**
     * Load an AI to this controller.
     * @param {string} type - Type of code
     * @param {string} code - AI code 
     */
    loadAI(type: string, code: string): void;

    /**
     * Unload the AI from this controller.
     */
    unloadAI(): void;
}

// Allow to smoothly load and unload AI code to override inputs
class Controller implements IController {
    // Unique identifier
    private _id: number;

    // Controller for receiving player inputs if human controller
    private _inputController?: IInputController;

    private _ai: {
        update?: (state: any) => void
    } = {};
    private _input = {};

    get id(): number {
        return this._id;
    }

    get isBound(): boolean {
        return false;
    }

    get label(): string {
        if (this._inputController !== undefined) {
            return 'human';
        }

        return '<>';
    }

    constructor(id: number, inputController?: IInputController) {
        this._id = id;
        this._inputController = inputController;
    }

    sendState(state: any): void {
        if (this._ai.update !== undefined) {
            this._ai.update(state);
        }
    }

    inputs(): any {
        if (this._inputController !== undefined) {
            return this._inputController.inputs();
        }
        
        return this._input;
    }

    loadAI(type: string, code?: string): void {
        if (code === undefined) {
            code = type;
            type = 'javascript';
        }
        
        (new Function('exports', 'sendInput', code))(this._ai, (state: any) => this._sendInput(state));
    }

    unloadAI(): void {
        this._ai = {};
        this._input = {};
    }

    private _sendInput(state: any): void {
        this._input = state;
    }
}

// Aggregate multiple controllers
export class ControllerBus {
    // Connected controllers
    private _controllers: Map<number, IController> = new Map();

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    constructor(options: {
        inputController: () => IInputController
    }) {
        this._controllers.set(0, new Controller(0, options.inputController()));
        this._controllers.set(1, new Controller(1));
    }

    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    get(controllerId: number): IController | undefined {
        return this._controllers.get(controllerId);
    }

    /**
     * Send game state to all or a single controller.
     * @param {any} state - Game state
     * @param {number} controllerId - Specific controller
     */
    sendState(state: any, controllerId?: number): void {
        if (controllerId === undefined) {
            this._controllers.forEach(_ => _.sendState(state));
            return;
        }

        const controller = this._controllers.get(controllerId);
        if (controller !== undefined) {
            controller.sendState(state);
        }
    }
}