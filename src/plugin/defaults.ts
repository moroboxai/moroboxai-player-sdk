import {
    Plugin,
    PluginContext,
    LoadHeaderPluginOptions,
    LoadBootPluginOptions,
    LoadAgentPluginOptions
} from "./hooks";
import type { GameHeader, BootFunction } from "moroboxai-game-sdk";
import * as Agent from "@/agent";
import type { IAgent } from "@agent/types";
import YAML from "yaml";

/**
 * use this type for plugin annotation
 * @example
 * ```ts
 * interface Options {
 * ...
 * }
 * const myPlugin: PluginImpl<Options> = (options = {}) => { ... }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type PluginImpl<O extends object = object, A = any> = (
    options?: O
) => Plugin<A>;

interface GetBootFunctionResult {
    // What contains the boot function
    context: any;
    // Boot function if found
    boot?: BootFunction;
}

/**
 * Eval a script and try to get the boot function.
 * @param {string} script - game script
 */
function getBootFunction(script: string): GetBootFunctionResult {
    let _exports: any = {};
    let _module = { exports: { boot: undefined } };
    const result: GetBootFunctionResult = {
        context: new Function("exports", "module", "define", script)(
            _exports,
            _module,
            undefined
        )
    };

    // Try various exports
    if (_exports.boot !== undefined) {
        result.boot = _exports.boot;
    } else if (_module.exports.boot !== undefined) {
        result.boot = _module.exports.boot;
    } else if (
        result.context === "object" &&
        result.context.boot !== undefined
    ) {
        result.boot = result.context.boot;
    }

    return result;
}

function loadHeader(
    this: PluginContext,
    options: LoadHeaderPluginOptions
): Promise<GameHeader> {
    return new Promise<GameHeader>(async (resolve, reject) => {
        // The header is provided by user
        if (options.header !== undefined) {
            return resolve(options.header);
        }

        if (options.url === undefined) {
            return reject("failed to get header");
        }

        let headerName = options.url.split("/").slice(-1)[0];
        if (!headerName.endsWith(".yml") && !headerName.endsWith(".yaml")) {
            headerName = "header.yml";
        }

        console.log(`load header ${headerName}...`);
        const script = await options.gameServer.get(headerName);

        options.header = YAML.parse(script) as GameHeader;
        return resolve(options.header);
    });
}

function loadBoot(
    this: PluginContext,
    options: LoadBootPluginOptions
): Promise<BootFunction> {
    return new Promise<BootFunction>(async (resolve) => {
        if (options.boot === undefined) {
            throw "no boot specified";
        }

        if (typeof options.boot === "function") {
            // This is already a boot function
            return resolve(options.boot);
        }

        if (typeof options.boot === "object") {
            // This is an object containing a boot function
            return resolve(options.boot.boot);
        }

        if (!options.boot.endsWith(".js") && !options.boot.endsWith(".ts")) {
            // Doesn't reference a filename, maybe a module name
            const m = (window as any)[options.boot];
            if (m === undefined) {
                throw `boot module ${options.boot} not found`;
            }

            if (m.boot === undefined) {
                throw `no boot function found in module ${options.boot}`;
            }

            return resolve(m.boot);
        }

        if (options.boot.startsWith("http")) {
            // From remote URL
            const res = await fetch(options.boot);
            if (!res.ok) {
                throw res.statusText;
            }

            const script = await res.text();
            const result = getBootFunction(script);
            if (result.boot === undefined) {
                throw `no boot function found in ${options.boot}`;
            }

            options.context = result.context;
            return resolve(result.boot);
        }

        // File served by the game server
        const script = await options.gameServer.get(options.boot);
        const result = getBootFunction(script);
        if (result.boot === undefined) {
            throw `no boot function found in ${options.boot}`;
        }

        options.context = result.context;
        return resolve(result.boot);
    });
}

function loadAgent(
    this: PluginContext,
    options: LoadAgentPluginOptions
): Promise<IAgent | undefined> {
    return new Promise<IAgent | undefined>(async (resolve) => {
        // Already have the agent
        if (options.agent !== undefined) {
            return resolve(options.agent);
        }

        console.log(options);
        let language = options.language;

        // Load the script
        let script = options.script;
        if (script === undefined) {
            if (options.fileServer === undefined) {
                throw "can't load agent without a file server";
            }

            // Filename can be an archive or script
            let main = options.fileServer.filename;
            if (main === undefined || main.endsWith(".zip")) {
                // Fallback to the default language and filename
                language = "javascript";
                main = Agent.main(language);
            } else if (language === undefined) {
                // Try deduce the language from filename
                language = Agent.language(main);
            }

            if (language === undefined) {
                throw `unknown agent language for ${main}`;
            }

            script = await options.fileServer.get(main);
        } else {
            // For direct scripts use javascript
            language = "javascript";
        }

        const agent = Agent.init({
            baseUrl: options.fileServer?.baseUrl ?? "",
            language: language,
            script,
            api: options.api
        });

        return resolve(agent);
    });
}

export namespace plugins {
    export const defaultPlugin: PluginImpl<object> = (options?: object) => {
        return {
            name: "default",
            loadHeader,
            loadBoot,
            loadAgent
        };
    };

    export const injectHeader: PluginImpl<GameHeader> = (
        header?: GameHeader
    ) => {
        return {
            name: "injectHeader",
            /**
             * Default loading of the header.
             * @param {LoadHeaderOptions} options - loading options
             * @returns the header
             */
            loadHeader(
                this: PluginContext,
                options: LoadHeaderPluginOptions
            ): Promise<GameHeader> {
                return new Promise<GameHeader>((resolve, reject) => {
                    options.header = {
                        ...(options.header ?? {}),
                        ...(header ?? {})
                    };

                    return resolve(options.header);
                });
            }
        };
    };
}
