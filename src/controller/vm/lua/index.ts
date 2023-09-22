import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import * as MoroboxAILua from "moroboxai-lua";
import { getstring, getobject, push, pop, get, call } from "moroboxai-lua";
import { IVM } from "../_utils";
import { lua_State, lua, to_luastring } from "fengari-web";

class LuaVM implements IVM {
    private _instance: MoroboxAILua.IVM;

    get luaState(): lua_State {
        return this._instance.luaState;
    }

    constructor(instance: MoroboxAILua.IVM) {
        this._instance = instance;
    }

    saveState(): object {
        call(this.luaState, "saveState");
        return pop(this.luaState);
    }

    loadState(state: object): void {
        call(this.luaState, "loadState", state);
    }

    inputs(state: object): MoroboxAIGameSDK.IInputs {
        call(this.luaState, "inputs", state);
        return pop(this.luaState, -1);
    }
}

/**
 * Initialize a new Lua VM for running a script.
 * @param {string} script - script to inject
 * @param {Moroxel8AISDK.IMoroxel8AI} api - interface for the CPU
 * @returns {any} - new Lua VM
 */
export function initLua(script: string | undefined): IVM | undefined {
    const instance = MoroboxAILua.initLua({
        script
    });

    return instance !== undefined ? new LuaVM(instance) : undefined;
}
