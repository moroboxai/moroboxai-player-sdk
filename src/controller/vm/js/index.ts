import type { Inputs } from "moroboxai-game-sdk";
import { IVM, AGENT_FUNCTIONS } from "../_utils";

class JSVM implements IVM {
    private _fun: Function;
    private _context: any;

    constructor(fun: Function, context: any) {
        this._fun = fun;
        this._context = context;
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

/**
 * Initialize a new JS VM for running a script.
 * @param {string} script - script to inject
 * @returns {IVM} - new JS VM
 */
export function initJS(script: string | undefined): IVM {
    const context = {};
    const builtins: any = {
        // For exposing functions from game
        exports: context
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
    return new JSVM(fun, context);
}
