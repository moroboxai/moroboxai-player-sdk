import { Plugin, PluginContext, LoadHeaderOptions } from "./hooks";
import { GameHeader, IBoot } from "moroboxai-game-sdk";
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

export interface IInjectBootOptions {
    boot: IBoot;
}

export const injectBoot: PluginImpl<IInjectBootOptions> = (
    options?: IInjectBootOptions
) => {
    return {
        name: "injectBoot",
        /**
         * Default loading of the header.
         * @param {LoadHeaderOptions} options - loading options
         * @returns the header
         */
        loadHeader(
            this: PluginContext,
            options_: LoadHeaderOptions
        ): Promise<GameHeader> {
            return new Promise<GameHeader>((resolve, reject) => {
                if (options_.header === undefined) {
                    return reject();
                }

                if (options !== undefined) {
                    options_.header.boot = options?.boot;
                }

                return resolve(options_.header);
            });
        }
    };
};
