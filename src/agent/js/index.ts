import type { Inputs } from "moroboxai-game-sdk";
import type { LanguageConfig, IAgent } from "@agent/types";
import { AGENT_FUNCTIONS } from "@agent/_utils";

class JSAgent implements IAgent {
    private _fun: Function;
    private _context: any;

    constructor(fun: Function, context: any) {
        this._fun = fun;
        this._context = context;
    }

    get label(): string {
        return this._context.label ?? "unknown";
    }

    saveState(): object {
        if (this._context.saveState !== undefined) {
            return this._context.saveState();
        }

        return {};
    }

    loadState(state: object): void {
        if (this._context.loadState !== undefined) {
            this._context.loadState(state);
        }
    }

    inputs(state: object): Inputs {
        if (this._context.inputs !== undefined) {
            return this._context.inputs(state);
        }

        return {};
    }
}

const config: LanguageConfig = {
    extensions: [".js"],
    main: "agent.js",
    init(options): IAgent | undefined {
        const { api, script } = options;
        const context = {};
        const builtins: any = {
            // For exposing functions from agent
            exports: context,
            // Builtin functions
            require: api.require.bind(api)
        };

        const params = Object.keys(builtins);
        const fun = new Function(
            ...params,
            `${script}\n; ${AGENT_FUNCTIONS.map(
                (name) =>
                    `if (typeof ${name} !== "undefined") exports.${name} = ${name}`
            ).join(";")}`
        );

        fun(...params.map((_) => builtins[_]));
        return new JSAgent(fun, context);
    }
};

export default config;
