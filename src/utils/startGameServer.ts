import type { IGameServer, IFileServer } from "moroboxai-game-sdk";
import type { SDKConfig } from "@/player";
import { GameServer } from "@/server";

/**
 * Create a file server base on URL ending.
 * @param {string} baseUrl - Base URL
 * @returns {IFileServer} A file server
 */
function createFileServer(sdkConfig: SDKConfig, baseUrl: string): IFileServer {
    // Point to zip file
    if (baseUrl.endsWith(".zip")) {
        return sdkConfig.zipServer(baseUrl);
    }

    // Point to header.yml so take parent URL
    if (baseUrl.endsWith(".yaml") || baseUrl.endsWith(".yml")) {
        const pos = baseUrl.lastIndexOf("/");
        baseUrl = pos < 0 ? "" : baseUrl.substring(0, pos);
    }

    return sdkConfig.fileServer(baseUrl);
}

/**
 * Start the game server based on game URL.
 * @param {ISDKConfig} config - config of the SDK
 * @param {stirng} url - URL of the game
 */
export function startGameServer(
    config: SDKConfig,
    url: string
): Promise<IGameServer> {
    return new Promise<IGameServer>((resolve) => {
        const fileServer = createFileServer(config, url);
        const gameServer = new GameServer(fileServer);
        gameServer.ready(() => {
            return resolve(gameServer);
        });
    });
}
