import { initJS } from "./js";
import { initLua } from "./lua";
import type { IAgent } from "./_utils";
export type { IAgent } from "./_utils";

// Supported languages for agents
export type AgentLanguage = "javascript" | "lua";

export function initAgent(
    language: AgentLanguage,
    script: string | undefined
): IAgent | undefined {
    switch (language) {
        case "lua":
            return initLua(script);
        case "javascript":
            return initJS(script);
        default:
            return undefined;
    }
}
