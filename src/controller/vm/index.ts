import { initJS } from "./js";
import { initLua } from "./lua";
import type { IVM } from "./_utils";
export type { IVM } from "./_utils";

// Supported languages for agents
export type AgentLanguage = "javascript" | "lua";

export function initVM(
    language: AgentLanguage,
    script: string | undefined
): IVM | undefined {
    switch (language) {
        case "lua":
            return initLua(script);
        case "javascript":
            return initJS(script);
        default:
            return undefined;
    }
}
