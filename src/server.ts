import * as MoroboxAIGameSDK from "moroboxai-game-sdk";

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

/**
 * Serve files from URL with fetch.
 */
export class FetchFileServer implements MoroboxAIGameSDK.IFileServer {
    // Complete URL
    private _url: string;
    // Base URL
    private _baseUrl: string;
    // Filename
    private _filename?: string;

    constructor(url: string) {
        this._url = url;

        // Remove the filename
        const pos = url.lastIndexOf("/");
        if (url.lastIndexOf(".", pos) !== -1) {
            if (pos === -1) {
                this._baseUrl = "";
            } else {
                this._baseUrl = url.substring(0, pos);
            }
            this._filename = url.substring(pos + 1);
        } else {
            this._baseUrl = url;
        }

        // Ensure the trailing /
        if (!this._baseUrl.endsWith("/")) {
            this._baseUrl = this._baseUrl + "/";
        }
    }

    get url(): string {
        return this._url;
    }

    get baseUrl(): string {
        return this._baseUrl;
    }

    get filename(): string | undefined {
        return this._filename;
    }

    href(path: string): string {
        return `${this.baseUrl}${path}`;
    }

    get(path: string): Promise<string> {
        return getUrl(this.href(path));
    }

    ready(callback: () => void): void {
        // No setup required, so call the callback right now
        if (callback) {
            callback();
        }
    }

    close(callback?: (err: any) => void): void {
        // No cleanup required, so call the callback right now
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

    get url(): string {
        return this._server.url;
    }

    get baseUrl(): string {
        return this._server.baseUrl;
    }

    get filename(): string | undefined {
        return this._server.filename;
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
}
