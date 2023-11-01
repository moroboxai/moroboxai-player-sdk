import type { Inputs } from "moroboxai-game-sdk";
import * as MoroboxAILua from "moroboxai-lua";
import { pop, call } from "moroboxai-lua";
import type { LanguageConfig, IAgent } from "@agent/types";
import { lua_State } from "fengari-web";

class LuaAgent implements IAgent {
    private _instance: MoroboxAILua.IVM;

    get luaState(): lua_State {
        return this._instance.luaState;
    }

    constructor(instance: MoroboxAILua.IVM) {
        this._instance = instance;
    }

    get label(): string {
        return "unknown";
    }

    saveState(): object {
        call(this.luaState, "saveState");
        return pop(this.luaState);
    }

    loadState(state: object): void {
        call(this.luaState, "loadState", state);
    }

    inputs(state: object): Inputs {
        call(this.luaState, "inputs", state);
        return pop(this.luaState);
    }
}

const config: LanguageConfig = {
    extensions: [".lua"],
    main: "agent.lua",
    init(options): IAgent | undefined {
        const instance = MoroboxAILua.initLua({
            /*api: {
                require: func("require([s])", 1, (luaState: lua_State) => {
                    const size = nargs(luaState);
    
                    return 0;
                })
            },*/
            path: options.baseUrl,
            script: options.script
        });

        return instance !== undefined ? new LuaAgent(instance) : undefined;
    }
};

export default config;
