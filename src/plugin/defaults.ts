import { Plugin, PluginContext, LoadHeaderOptions } from "./hooks";
import type { GameHeader } from "moroboxai-game-sdk";
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

export namespace plugins {
    export const defaultPlugin: PluginImpl<object> = (options?: object) => {
        return {
            name: "default",
            /**
             * Default loading of the header.
             * @param {LoadHeaderOptions} options - loading options
             * @returns the header
             */
            loadHeader(
                this: PluginContext,
                options: LoadHeaderOptions
            ): Promise<GameHeader> {
                return new Promise<GameHeader>((resolve, reject) => {
                    // The header is provided by user
                    if (options.header !== undefined) {
                        return resolve(options.header);
                    }

                    if (
                        options.url === undefined ||
                        this.gameServer === undefined
                    ) {
                        return reject("failed to get header");
                    }

                    let headerName = options.url.split("/").slice(-1)[0];
                    if (
                        !headerName.endsWith(".yml") &&
                        !headerName.endsWith(".yaml")
                    ) {
                        headerName = "header.yml";
                    }
                    console.log(`load header ${headerName}...`);
                    return this.gameServer.get(headerName).then((data) => {
                        options.header = YAML.parse(data) as GameHeader;
                        return resolve(options.header);
                    });
                });
            }
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
                options: LoadHeaderOptions
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
