import * as MoroboxAIGameSDK from "moroboxai-game-sdk";
import YAML from "yaml";

// Name of the header file
const HEADER_FILE = "header.yml";

/**
 * Fetch data from an URL.
 * @param {string} url - Remote URL
 * @returns {Promise} Data when ready
 */
export function getUrl(url: string): Promise<string> {
    return fetch(url)
        .then((response) => {
            if (!response.ok) {
                return Promise.reject(response.status);
            }

            return response.blob();
        })
        .then((blob) => {
            return blob.text();
        });
}

// Serve files from remote URL
export class FetchFileServer implements MoroboxAIGameSDK.IFileServer {
    // Base URL of the files
    baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    href(path: string): string {
        return `${this.baseUrl}/${path}`;
    }

    get(path: string): Promise<string> {
        return getUrl(this.href(path));
    }

    ready(callback: () => void): void {
        if (callback) {
            callback();
        }
    }

    close(callback?: (err: any) => void): void {
        if (callback) {
            callback(null);
        }
    }
}

export class GameServer implements MoroboxAIGameSDK.IGameServer {
    private _server: MoroboxAIGameSDK.IFileServer;

    constructor(server: MoroboxAIGameSDK.IFileServer) {
        this._server = server;
    }

    href(path: string): string {
        return this._server.href(path);
    }

    get(path: string): Promise<string> {
        return this._server.get(path);
    }

    ready(callback: () => void): void {
        this._server.ready(callback);
    }

    close(callback?: (err: any) => void): void {
        this._server.close(callback);
    }

    gameHeader(): Promise<MoroboxAIGameSDK.GameHeader> {
        return this._server.get(HEADER_FILE).then((data) => {
            return YAML.parse(data) as MoroboxAIGameSDK.GameHeader;
        });
    }
}
