import type { Controller as ControllerState } from "moroboxai-game-sdk";
import type { Inputs } from "moroboxai-game-sdk";
import { initVM } from "./vm";
import type { AgentLanguage, IVM } from "./vm";
export type { AgentLanguage } from "./vm";

/**
 * Information of a loaded agent.
 */
interface Agent {
    // Language of the code
    language: AgentLanguage;
    // URL of the agent
    url?: string;
    // Code of the agent
    code: string;
}

/**
 * Options for loading an agent.
 */
export type LoadAgentOptions = {
    // Language of the code
    language?: AgentLanguage;
} & (
    | {
          // URL where to find the code
          url: string;
          code?: never;
      }
    | {
          url?: never;
          // Direct code of the agent
          code: string;
      }
);

/**
 * Interface for the keyboard or gamepad.
 */
export interface IInputController {
    // Pressed inputs
    inputs: Inputs;
}

export interface IController {
    readonly id: number;
    readonly label: string;
    readonly isBound: boolean;
    readonly isAgent: boolean;
    readonly isPlayer: boolean;

    /**
     * Get inputs based on game state.
     * @param {object} state - game state
     * @returns {Inputs} Inputs
     */
    inputs(state: object): Inputs;

    saveState(): object;

    loadState(state: object): void;

    /**
     * Load an agent to this controller.
     * @param {LoadAgentOptions} options - options for loading
     */
    loadAgent(options: LoadAgentOptions): Promise<void>;

    /**
     * Unload the agent.
     */
    unloadAgent(): void;
}

class AgentController implements IController {
    // Loaded agent
    private _agent?: Agent;

    // VM running the code for the agent
    private _vm?: IVM;

    // Has the VM exception been logged
    private _exceptionLogged: boolean = false;

    get id(): number {
        return 0;
    }

    get label(): string {
        return "Agent";
    }

    get isBound(): boolean {
        return this._vm !== undefined;
    }

    get isAgent(): boolean {
        return true;
    }

    get isPlayer(): boolean {
        return false;
    }

    loadAgent(options: LoadAgentOptions): Promise<void> {
        return new Promise<void>((resolve) => {
            function typeFromUrl(url: string): AgentLanguage {
                if (url.endsWith(".lua")) {
                    return "lua";
                }

                return "javascript";
            }

            const loadFromCode = (
                language: AgentLanguage,
                url: string | undefined,
                code: string
            ) => {
                const vm = initVM(language, code);

                this._agent = {
                    language,
                    url,
                    code
                };
                this.unloadAgent();
                this._vm = vm;
                this._exceptionLogged = false;

                resolve();
            };

            if (options.url !== undefined) {
                fetch(options.url)
                    .then((response) => response.text())
                    .then((code) =>
                        loadFromCode(
                            options.language !== undefined
                                ? options.language
                                : typeFromUrl(options.url!),
                            options.url,
                            code
                        )
                    );
            } else if (options.code !== undefined) {
                loadFromCode(
                    options.language ?? "javascript",
                    undefined,
                    options.code
                );
            }
        });
    }

    unloadAgent(): void {
        this._vm = undefined;
    }

    inputs(state: object): Inputs {
        if (this._vm !== undefined) {
            try {
                return this._vm.inputs(state);
            } catch (e) {
                if (!this._exceptionLogged) {
                    this._exceptionLogged = true;
                    console.log("error calling inputs", e);
                }
            }
        }

        return {};
    }

    saveState(): object {
        if (this._vm !== undefined) {
            try {
                return this._vm.saveState();
            } catch (e) {
                if (!this._exceptionLogged) {
                    this._exceptionLogged = true;
                    console.log("error calling saveState", e);
                }
            }
        }

        return {};
    }

    loadState(state: object) {
        if (this._vm !== undefined) {
            try {
                this._vm.loadState(state);
            } catch (e) {
                if (!this._exceptionLogged) {
                    this._exceptionLogged = true;
                    console.log("error calling loadState", e);
                }
            }
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

    get label(): string {
        if (this._agentController.isBound) {
            return this._agentController.label;
        }

        if (this._inputController !== undefined) {
            return "human";
        }

        return "<>";
    }

    get isBound(): boolean {
        return this._inputController !== undefined;
    }

    get isAgent(): boolean {
        return this._agentController.isBound;
    }

    get isPlayer(): boolean {
        return this.isBound && !this.isAgent;
    }

    constructor(id: number, inputController?: IInputController) {
        this._id = id;
        this._inputController = inputController;
        this._agentController = new AgentController();
    }

    inputs(state: object): Inputs {
        if (this._agentController.isBound) {
            return this._agentController.inputs(state);
        }

        if (this._inputController !== undefined) {
            return this._inputController.inputs;
        }

        return {};
    }

    loadAgent(options: LoadAgentOptions): Promise<void> {
        return this._agentController.loadAgent(options);
    }

    unloadAgent(): void {
        this._agentController.unloadAgent();
    }

    saveState(): object {
        return this._agentController.saveState();
    }

    loadState(state: object) {
        this._agentController.loadState(state);
    }
}

// Aggregate multiple controllers
export class ControllerBus {
    // Connected controllers
    private _controllers: Map<number, IController> = new Map();
    private _controllersArray: IController[];

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    get controllers(): Map<number, IController> {
        return this._controllers;
    }

    constructor(options: { inputController: () => IInputController }) {
        this._controllersArray = [
            new Controller(0, options.inputController()),
            new Controller(1)
        ];
        this._controllers.set(0, this._controllersArray[0]);
        this._controllers.set(1, this._controllersArray[1]);
    }

    /**
     * Get a controller by id.
     * @param {number} controllerId - Controller id
     * @returns {IController} Controller
     */
    get(controllerId: number): IController | undefined {
        return this._controllers.get(controllerId);
    }

    inputs(state: object): Array<ControllerState> {
        return this._controllersArray.map((controller) => ({
            label: controller.label,
            isBound: controller.isBound,
            isPlayer: controller.isPlayer,
            isAgent: controller.isAgent,
            inputs: controller.inputs(state)
        }));
    }

    saveState(): Array<object> {
        return [
            this._controllers.get(0)!.saveState(),
            this._controllers.get(1)!.saveState()
        ];
    }

    loadState(state: Array<object>) {
        this._controllers.get(0)!.loadState(state);
        this._controllers.get(1)!.loadState(state);
    }
}
