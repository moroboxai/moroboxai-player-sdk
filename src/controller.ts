import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';

/**
 * Interface for the keyboard or gamepad.
 */
export interface IInputController {
    // Pressed inputs
    inputs: MoroboxAIGameSDK.IInputs;
}

export interface IController extends MoroboxAIGameSDK.IController {
    /**
     * Get inputs base on game state.
     * @param {object} state - game state
     * @returns {IInputs} Inputs
     */
    inputs(state: object): MoroboxAIGameSDK.IInputs;
}

class AgentController implements IController {
    private _context: {
        // Label to display for this agent
        LABEL?: string;
        // Function exported from the code to compute the next input
        inputs?: (state: object) => MoroboxAIGameSDK.IInputs;
        // Function exported from the code to reset the controller
        reset?: () => void;
    } = {};

    get id(): number {
        return 0;
    }

    get isBound(): boolean {
        return this._context.inputs !== undefined;
    }

    get label(): string {
        return this._context.LABEL !== undefined ? this._context.LABEL : 'Agent';
    }

    loadAgent(options: {
        type?: string;
        code?: string;
        url?: string;
    }): Promise<void> {
        return new Promise<void>((resolve) => {
            function typeFromUrl(url: string): string {
                return "javascript";
            }

            const loadFromCode = (type: string, code: string) => {
                const context = {};
                (new Function('exports', code))(context);

                this.unloadAgent();
                this._context = context;

                resolve();
            };

            if (options.url !== undefined) {
                fetch(options.url).then(response => response.text()).then(code => loadFromCode(options.type !== undefined ? options.type : typeFromUrl(options.url!), code));
            } else if (options.code !== undefined) {
                loadFromCode(options.type !== undefined ? options.type : "javascript", options.code);
            }
        });
    }

    unloadAgent(): void {
        this._context = {};
    }

    inputs(state: object): MoroboxAIGameSDK.IInputs {
        if (this._context.inputs === undefined) {
            return {}
        }

        return this._context.inputs(state);
    }

    reset() {
        if (this._context.reset !== undefined) {
            this._context.reset();
        }
    }
}

// Allow to smoothly load and unload AI code to override inputs
class Controller implements IController {
    // Unique identifier
    private _id: number;

    // Controller for receiving player inputs if human controller
    private _inputController?: IInputController;

    // Controller for when an agent is bound
    private _agentController: AgentController;

    get id(): number {
        return this._id;
    }

    get isBound(): boolean {
        return false;
    }

    get label(): string {
        if (this._agentController.isBound) {
            return this._agentController.label;
        }

        if (this._inputController !== undefined) {
            return 'human';
        }

        return '<>';
    }

    constructor(id: number, inputController?: IInputController) {
        this._id = id;
        this._inputController = inputController;
        this._agentController = new AgentController();
    }

    inputs(state: object): MoroboxAIGameSDK.IInputs {
        if (this._agentController.isBound) {
            return this._agentController.inputs(state);
        }

        if (this._inputController !== undefined) {
            return this._inputController.inputs;
        }

        return {};
    }

    loadAgent(options: {
        type?: string;
        code?: string;
        url?: string;
    }): Promise<void> {
        return this._agentController.loadAgent(options);
    }

    unloadAgent(): void {
        this._agentController.unloadAgent();
    }

    reset() {
        this._agentController.reset();
    }
}

// Aggregate multiple controllers
export class ControllerBus {
    // Connected controllers
    private _controllers: Map<number, IController> = new Map();

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    get controllers(): Map<number, IController> {
        return this._controllers;
    }

    constructor(options: {
        player: MoroboxAIGameSDK.IPlayer,
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

    inputs(state: object): Array<MoroboxAIGameSDK.IInputs> {
        return [
            this._controllers.get(0)!.inputs(state),
            this._controllers.get(1)!.inputs(state),
        ];
    }

    // Reset the controllers
    reset() {
        this._controllers.forEach(controller => controller.reset());
    }
}