import {
    AsyncPluginHooks,
    FunctionPluginHooks,
    Plugin,
    PluginContext
} from "./hooks";
import { getOrCreate } from "../utils/getOrCreate";

/**
 * Get the type of the first argument in a function.
 * @example Arg0<(a: string, b: number) => void> -> string
 */
type Argument0<H extends keyof FunctionPluginHooks> = Parameters<
    FunctionPluginHooks[H]
>[0];

export type ReplaceContext = (
    context: PluginContext,
    plugin: Plugin
) => PluginContext;

export type HookAction = [plugin: string, hook: string, args: unknown[]];

export class PluginDriver {
    readonly plugins: readonly Plugin[];
    private readonly pluginContexts: ReadonlyMap<Plugin, PluginContext>;
    private readonly sortedPlugins = new Map<AsyncPluginHooks, Plugin[]>();
    private readonly unfulfilledActions = new Set<HookAction>();

    constructor(
        ctxt: PluginContext,
        plugins: readonly Plugin[],
        basePluginDriver?: PluginDriver
    ) {
        this.plugins = [
            ...(basePluginDriver ? basePluginDriver.plugins : []),
            ...plugins
        ];

        this.pluginContexts = new Map(
            this.plugins.map((plugin) => [plugin, ctxt])
        );
    }

    // chains, first non-null result stops and returns
    hookFirst<H extends AsyncPluginHooks>(
        hookName: H,
        parameters: Parameters<FunctionPluginHooks[H]>,
        replaceContext?: ReplaceContext | null,
        skipped?: ReadonlySet<Plugin> | null
    ): Promise<ReturnType<FunctionPluginHooks[H]> | null> {
        return this.hookFirstAndGetPlugin(
            hookName,
            parameters,
            replaceContext,
            skipped
        ).then((result) => result && result[0]);
    }

    // chains, first non-null result stops and returns result and last plugin
    async hookFirstAndGetPlugin<H extends AsyncPluginHooks>(
        hookName: H,
        parameters: Parameters<FunctionPluginHooks[H]>,
        replaceContext?: ReplaceContext | null,
        skipped?: ReadonlySet<Plugin> | null
    ): Promise<
        [NonNullable<ReturnType<FunctionPluginHooks[H]>>, Plugin] | null
    > {
        for (const plugin of this.getSortedPlugins(hookName)) {
            if (skipped?.has(plugin)) continue;
            const result = await this.runHook(
                hookName,
                parameters,
                plugin,
                replaceContext
            );
            if (result != null) return [result, plugin];
        }
        return null;
    }

    // parallel, ignores returns
    async hookParallel<H extends AsyncPluginHooks>(
        hookName: H,
        parameters: Parameters<FunctionPluginHooks[H]>,
        replaceContext?: ReplaceContext
    ): Promise<void> {
        const parallelPromises: Promise<unknown>[] = [];
        for (const plugin of this.getSortedPlugins(hookName)) {
            if ((plugin[hookName] as { sequential?: boolean }).sequential) {
                await Promise.all(parallelPromises);
                parallelPromises.length = 0;
                await this.runHook(
                    hookName,
                    parameters,
                    plugin,
                    replaceContext
                );
            } else {
                parallelPromises.push(
                    this.runHook(hookName, parameters, plugin, replaceContext)
                );
            }
        }
        await Promise.all(parallelPromises);
    }

    // chains, reduces returned value, handling the reduced value as the first hook argument
    hookReduceArg0<H extends AsyncPluginHooks>(
        hookName: H,
        [argument0, ...rest]: Parameters<FunctionPluginHooks[H]>,
        reduce: (
            reduction: Argument0<H>,
            result: ReturnType<FunctionPluginHooks[H]>,
            plugin: Plugin
        ) => Argument0<H>,
        replaceContext?: ReplaceContext
    ): Promise<Argument0<H>> {
        let promise = Promise.resolve(argument0);
        for (const plugin of this.getSortedPlugins(hookName)) {
            promise = promise.then((argument0) =>
                this.runHook(
                    hookName,
                    [argument0, ...rest] as Parameters<FunctionPluginHooks[H]>,
                    plugin,
                    replaceContext
                ).then((result) =>
                    reduce.call(
                        this.pluginContexts.get(plugin),
                        argument0,
                        result,
                        plugin
                    )
                )
            );
        }
        return promise;
    }

    private getSortedPlugins(
        hookName: keyof FunctionPluginHooks,
        validateHandler?: (
            handler: unknown,
            hookName: string,
            plugin: Plugin
        ) => void
    ): Plugin[] {
        return getOrCreate(this.sortedPlugins, hookName, () =>
            getSortedValidatedPlugins(hookName, this.plugins, validateHandler)
        );
    }

    /**
     * Run an async plugin hook and return the result.
     * @param hookName Name of the plugin hook. Must be either in `PluginHooks`
     *   or `OutputPluginValueHooks`.
     * @param args Arguments passed to the plugin hook.
     * @param plugin The actual pluginObject to run.
     * @param replaceContext When passed, the plugin context can be overridden.
     */
    private runHook<H extends AsyncPluginHooks>(
        hookName: H,
        parameters: Parameters<FunctionPluginHooks[H]>,
        plugin: Plugin,
        replaceContext?: ReplaceContext | null
    ): Promise<ReturnType<FunctionPluginHooks[H]>> {
        // We always filter for plugins that support the hook before running it
        const hook = plugin[hookName];
        const handler = typeof hook === "object" ? hook.handler : hook;

        let context = this.pluginContexts.get(plugin)!;
        if (replaceContext) {
            context = replaceContext(context, plugin);
        }

        let action: [string, string, Parameters<any>] | null = null;
        return Promise.resolve()
            .then(() => {
                if (typeof handler !== "function") {
                    return handler;
                }
                // eslint-disable-next-line @typescript-eslint/ban-types
                const hookResult = (handler as Function).apply(
                    context,
                    parameters
                );

                if (!hookResult?.then) {
                    // short circuit for non-thenables and non-Promises
                    return hookResult;
                }

                // Track pending hook actions to properly error out when
                // unfulfilled promises cause rollup to abruptly and confusingly
                // exit with a successful 0 return code but without producing any
                // output, errors or warnings.
                action = [plugin.name, hookName, parameters];
                this.unfulfilledActions.add(action);

                // Although it would be more elegant to just return hookResult here
                // and put the .then() handler just above the .catch() handler below,
                // doing so would subtly change the defacto async event dispatch order
                // which at least one test and some plugins in the wild may depend on.
                return Promise.resolve(hookResult).then((result) => {
                    // action was fulfilled
                    this.unfulfilledActions.delete(action!);
                    return result;
                });
            })
            .catch((error_) => {
                if (action !== null) {
                    // action considered to be fulfilled since error being handled
                    this.unfulfilledActions.delete(action);
                }

                throw error_;
            });
    }
}

export function getSortedValidatedPlugins(
    hookName: keyof FunctionPluginHooks,
    plugins: readonly Plugin[],
    validateHandler = validateFunctionPluginHandler
): Plugin[] {
    const pre: Plugin[] = [];
    const normal: Plugin[] = [];
    const post: Plugin[] = [];
    for (const plugin of plugins) {
        const hook = plugin[hookName];
        if (hook) {
            if (typeof hook === "object") {
                validateHandler(hook.handler, hookName, plugin);
                if (hook.order === "pre") {
                    pre.push(plugin);
                    continue;
                }
                if (hook.order === "post") {
                    post.push(plugin);
                    continue;
                }
            } else {
                validateHandler(hook, hookName, plugin);
            }
            normal.push(plugin);
        }
    }
    return [...pre, ...normal, ...post];
}

function validateFunctionPluginHandler(
    handler: unknown,
    hookName: string,
    plugin: Plugin
) {
    if (typeof handler !== "function") {
        throw `invalid plugin hook ${hookName} ${plugin}`;
    }
}
