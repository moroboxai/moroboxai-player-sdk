import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import type { AgentLanguage, IVM } from "./vm";
import { initVM } from "./vm";

export type { AgentLanguage } from "./vm";

/**
 * Interface for loaded agents.
 */
export interface IAgent {
    // Language of the code
    language: AgentLanguage;
    // URL of the agent
    url?: string;
    // Code of the agent
    code: string;
}

/**
 * Information for loading agents.
 */
export type IAgentOptions = {
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
    inputs: MoroboxAIGameSDK.IInputs;
}

export interface IController extends MoroboxAIGameSDK.IController {
    // Loaded agent
    readonly agent?: IAgent;

    /**
     * Get inputs base on game state.
     * @param {object} state - game state
     * @returns {IInputs} Inputs
     */
    inputs(state: object): MoroboxAIGameSDK.IInputs;

    saveState(): object;

    loadState(state: object): void;

    /**
     * Load an agent to this controller.
     * @param {IAgentOptions} options - options for loading
     */
    loadAgent(options: IAgentOptions): Promise<void>;

    /**
     * Unload the agent.
     */
    unloadAgent(): void;
}

class AgentController implements IController {
    // Loaded agent
    private _agent?: IAgent;

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

    get agent(): IAgent | undefined {
        return this._agent;
    }

    loadAgent(options: IAgentOptions): Promise<void> {
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

    inputs(state: object): MoroboxAIGameSDK.IInputs {
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

    get agent(): IAgent | undefined {
        return this._agentController.agent;
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

    loadAgent(options: IAgentOptions): Promise<void> {
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

    get ids(): number[] {
        return [...this._controllers.keys()];
    }

    get controllers(): Map<number, IController> {
        return this._controllers;
    }

    constructor(options: {
        player: MoroboxAIGameSDK.IPlayer;
        inputController: () => IInputController;
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
            this._controllers.get(1)!.inputs(state)
        ];
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
