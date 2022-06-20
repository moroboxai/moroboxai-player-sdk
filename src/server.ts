import * as MoroboxAIGameSDK from 'moroboxai-game-sdk';
import YAML from 'yaml';

// Name of the header file
const HEADER_FILE = "header.yml";

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
        return this._server.get(HEADER_FILE).then(data => {
            return YAML.parse(data) as MoroboxAIGameSDK.GameHeader;
        });
    }
    
}