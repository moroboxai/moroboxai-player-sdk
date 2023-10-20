import type {
    Controller as ControllerState,
    GameSaveState
} from "moroboxai-game-sdk";
import type { Inputs } from "moroboxai-game-sdk";
import { initAgent } from "./agent";
import type { AgentLanguage, IAgent } from "./agent";

/**
 * Options for loading an agent.
 */
export type LoadAgentOptions = {
    // Language of the script
    language?: AgentLanguage;
} & (
    | {
          // URL where to find the script
          url: string;
          script?: never;
      }
    | {
          url?: never;
          // Direct script of the agent
          script: string | IAgent;
      }
);

/**
 * Save state for the controllers.
 */
export interface ControllerSaveState {
    [key: string]: any;
}

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

    saveState(): ControllerSaveState;

    loadState(state: ControllerSaveState): void;

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
    private _agent?: IAgent;

    // Has the VM exception been logged
    private _exceptionLogged: boolean = false;

    get id(): number {
        return 0;
    }

    get label(): string {
        return "Agent";
    }

    get isBound(): boolean {
        return this._agent !== undefined;
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

            const loadFromScript = (
                language: AgentLanguage,
                script: string | IAgent
            ) => {
                const agent =
                    typeof script === "string"
                        ? initAgent(language, script)
                        : script;

                this.unloadAgent();
                this._agent = agent;
                this._exceptionLogged = false;

                resolve();
            };

            if (options.url !== undefined) {
                fetch(options.url)
                    .then((response) => response.text())
                    .then((script) =>
                        loadFromScript(
                            options.language !== undefined
                                ? options.language
                                : typeFromUrl(options.url!),
                            script
                        )
                    );
            } else if (options.script !== undefined) {
                loadFromScript(
                    options.language ?? "javascript",
                    options.script
                );
            }
        });
    }

    unloadAgent(): void {
        this._agent = undefined;
    }

    inputs(state: object): Inputs {
        if (this._agent !== undefined) {
            try {
                return this._agent.inputs(state);
            } catch (e) {
                if (!this._exceptionLogged) {
                    this._exceptionLogged = true;
                    console.log("error calling inputs", e);
                }
            }
        }

        return {};
    }

    saveState(): ControllerSaveState {
        if (this._agent !== undefined) {
            try {
                return this._agent.saveState();
            } catch (e) {
                if (!this._exceptionLogged) {
                    this._exceptionLogged = true;
                    console.log("error calling saveState", e);
                }
            }
        }

        return {};
    }

    loadState(state: ControllerSaveState) {
        if (this._agent !== undefined) {
            try {
                this._agent.loadState(state);
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
        return [
            this._controllers.get(0)!.saveState(),
            this._controllers.get(1)!.saveState()
        ];
    }

    loadState(state: ControllerSaveState[]) {
        this._controllers.get(0)!.loadState(state);
        this._controllers.get(1)!.loadState(state);
    }
}
