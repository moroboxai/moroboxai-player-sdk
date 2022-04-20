import {IController} from 'moroboxai-game-sdk';

export interface IMoroboxAIController extends IController {
    /**
     * Load an AI to this controller.
     * @param {string} code - AI code 
     */
    loadAI(code: string): void;

    // Unload the AI from this controller
    unloadAI(): void;
}

class MoroboxAIController implements IMoroboxAIController {
    private _id: number = 0;
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
        return "";
    }

    constructor(id: number) {
        this._id = id;
    }

    sendState(state: any): void {
        if (this._ai.update !== undefined) {
            this._ai.update(state);
        }
    }

    inputs(): any {
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
    private _controllers: Map<number, IMoroboxAIController> = new Map();

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    constructor() {
        this._controllers.set(0, new MoroboxAIController(0));
        this._controllers.set(1, new MoroboxAIController(1));
    }

    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    get(controllerId: number): IMoroboxAIController | undefined {
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