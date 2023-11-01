import js from "./js";
import lua from "./lua";
import type { AgentLanguage, LanguageConfig, IAgent, IAPI } from "./types";

const LANGUAGE_CONFIGS: { [key: string]: LanguageConfig } = {
    javascript: js,
    lua: lua
};

/**
 * Options for init.
 */
export interface InitOptions {
    // Base URL of the script
    baseUrl: string;
    // Language of the script
    language: AgentLanguage;
    // Script
    script: string;
    // API for the agent
    api: IAPI;
}

/**
 * Identity the language of a file.
 * @param {string} filename - name of file
 */
export function language(filename: string): AgentLanguage | undefined {
    const configs = Object.entries(LANGUAGE_CONFIGS);
    for (let i = 0; i < configs.length; ++i) {
        if (configs[i][1].extensions.some((ext) => filename.endsWith(ext))) {
            return configs[i][0] as AgentLanguage;
        }
    }

    return undefined;
}

/**
 * Get extensions for a language.
 * @param {AgentLanguage} language - language
 * @returns possible extensions
 */
export function extensions(language: AgentLanguage): string[] {
    return LANGUAGE_CONFIGS[language].extensions;
}

/**
 * Get the name of main script for a language.
 * @param {AgentLanguage} language - language
 * @returns main script
 */
export function main(language: AgentLanguage): string {
    return LANGUAGE_CONFIGS[language].main;
}

/**
 * Initialize an agent from a script.
 * @param {InitOptions} options - options
 * @returns a VM running the agent
 */
export function init(options: InitOptions): IAgent | undefined {
    return LANGUAGE_CONFIGS[options.language].init(options);
}
