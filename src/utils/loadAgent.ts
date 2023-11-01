import type { IFileServer } from "moroboxai-game-sdk";
import { PluginDriver } from "@/plugin";
import type { LoadAgentOptions, AgentLike, SDKConfig } from "@/player";
import type { IAgent, IAPI } from "@/agent/types";

function isLoadAgentOptions(
    o: LoadAgentOptions | IAgent
): o is LoadAgentOptions {
    o = o as LoadAgentOptions;
    return o.url !== undefined || o.script !== undefined;
}

/**
 * Options for the task.
 */
export interface LoadAgentTaskOptions {
    // How to load the agent
    options: AgentLike;
    // Config of the SDK
    sdkConfig: SDKConfig;
    // Plugins
    pluginDriver: PluginDriver;
    // API for the agent
    api: IAPI;
    // Called when the agent is loaded
    onAgentLoaded?: (task: LoadAgentTask) => void;
    // Called when there is an error loading the agent
    onAgentError?: (task: LoadAgentTask) => void;
}

/**
 * Task for loading an agent.
 */
class LoadAgentTask {
    options: LoadAgentTaskOptions;
    // Started file server
    fileServer?: IFileServer;
    // Loaded agent
    agent?: IAgent;
    // Error if any
    error?: any;
    // Has the task completed
    private _isDone: boolean = false;
    // Has a cancel been requested?
    private _cancelRequested: boolean = false;

    constructor(options: LoadAgentTaskOptions) {
        this.options = options;
    }

    /**
     * Load the agent.
     */
    loadAgent(): Promise<void> {
        return new Promise<void>((resolve) => {
            // Check if we directly have an agent
            if (!isLoadAgentOptions(this.options.options)) {
                return resolve();
            }

            // No file server without a valid URL
            if (this.options.options.url == undefined) {
                return resolve();
            }

            // File server
            console.log("start file server for agent...");
            this.fileServer = this.options.sdkConfig.fileServerFactory(
                this.options.options.url
            );
            this.fileServer.ready(() => resolve());
        })
            .then(async () => {
                // Check if we directly have an agent
                if (!isLoadAgentOptions(this.options.options)) {
                    this.agent = this.options.options;
                    return;
                }

                console.log("file server for agent started");

                console.log("load agent...");
                const loadAgentResult =
                    await this.options.pluginDriver.hookReduceArg0(
                        "loadAgent",
                        [
                            {
                                fileServer: this.fileServer,
                                language: this.options.options.language,
                                script: this.options.options.script,
                                api: this.options.api
                            }
                        ],
                        (options, result, plugin) => {
                            if (result !== null) {
                                options.agent = result;
                            }
                            return options;
                        }
                    );

                this.agent = loadAgentResult.agent;
                if (this.agent === undefined) {
                    throw "could not load agent";
                }
            })
            .then(() => {
                console.log("agent loaded", this.agent);
                this._isDone = true;
                if (this._cancelRequested) {
                    this.cancel();
                    return;
                }
                if (this.options.onAgentLoaded !== undefined) {
                    this.options.onAgentLoaded(this);
                }
            })
            .catch((reason: any) => {
                this._isDone = true;
                this.error = reason;
                this.cancel();
                if (this.options.onAgentError !== undefined) {
                    this.options.onAgentError(this);
                }
            });
    }

    cancel() {
        // Wait for the task to complete
        if (!this._isDone) {
            this._cancelRequested = true;
            return;
        }

        // Cleanup
        if (this.fileServer !== undefined) {
            this.fileServer.close();
            this.fileServer = undefined;
        }
    }
}

export default LoadAgentTask;
