export interface IController {
    // Unique ontroller id
    id: number;

    /*
    * Send game state to this controller.
    * @param {any} state - Game state
    */
    sendState(state: any): void;

    /**
     * Receive input from this controller.
     * @returns {any} Input state
     */
    input(): any;
}

class Controller implements IController {
    private _id: number = 0;
    private _ai: {
        update?: (state: any) => void
    } = {};
    private _input = {};

    get id(): number {
        return this._id;
    }

    constructor(id: number) {
        this._id = id;
    }

    sendState(state: any): void {
        if (this._ai.update !== undefined) {
            this._ai.update(state);
        }
    }

    input(): any {
        return this._input;
    }

    loadAI(code: string): void {
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

export class ControllerBus {
    // Connected controllers
    private _controllers: Map<number, IController> = new Map();

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    constructor() {
        this._controllers.set(0, new Controller(0));
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

    /**
     * Receive input for all or a single controller.
     * @returns {any} Input state
     */
    input(controllerId?: number): any {
        if (controllerId === undefined) {
            const inputs: {[id: number]: any} = {};
            for(let _ of this._controllers.values()) {
                inputs[_.id] = _.input();
            }
            return inputs;
        }

        const controller = this._controllers.get(controllerId);
        if (controller !== undefined) {
            return controller.input;
        }

        return {};
    }
}