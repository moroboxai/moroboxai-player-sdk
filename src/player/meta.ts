import type { BootLike, GameHeader } from "moroboxai-game-sdk";
import type { IController } from "@/controller";
export type {
    AgentLanguage,
    LoadAgentOptions,
    IInputController,
    IController
} from "@/controller";
import type { IPlayer, IMetaPlayer, PlayerSaveState } from "./types";

export class MetaPlayer implements IMetaPlayer {
    private _players: Array<IPlayer> = [];

    constructor(players?: Array<IPlayer>) {
        this._tickFromGame = this._tickFromGame.bind(this);
        this._handleReady = this._handleReady.bind(this);

        if (players !== undefined) {
            players.forEach((other) => this.addPlayer(other));
        }
    }

    get masterPlayer(): IPlayer | undefined {
        return this._players !== undefined ? this._players[0] : undefined;
    }

    get speed(): number {
        return this.masterPlayer!.speed;
    }

    set speed(val: number) {
        this._players.forEach((other) => (other.speed = val));
    }

    get width(): number {
        return this.masterPlayer!.width;
    }

    set width(val: number) {
        this._players.forEach((other) => (other.width = val));
    }

    get height(): number {
        return this.masterPlayer!.height;
    }

    set height(val: number) {
        this._players.forEach((other) => (other.height = val));
    }

    get scale(): number {
        return this.masterPlayer!.scale;
    }

    set scale(val: number) {
        this._players.forEach((other) => (other.scale = val));
    }

    get gameWidth(): number | undefined {
        return this.masterPlayer!.gameWidth;
    }

    get gameHeight(): number | undefined {
        return this.masterPlayer!.gameHeight;
    }

    get gameScale(): number | undefined {
        return this.masterPlayer!.gameScale;
    }

    get gameAspectRatio(): string | undefined {
        return this.masterPlayer!.gameAspectRatio;
    }

    get resizable(): boolean {
        return this.masterPlayer!.resizable;
    }

    set resizable(val: boolean) {
        this._players.forEach((other) => (other.resizable = val));
    }

    get url(): string {
        return this.masterPlayer!.url;
    }

    get boot(): BootLike | undefined {
        return this.masterPlayer!.boot;
    }

    set boot(val: BootLike | undefined) {
        this.masterPlayer!.boot = val;
    }

    get header(): GameHeader | undefined {
        return this.masterPlayer!.header;
    }

    get autoPlay(): boolean {
        return this.masterPlayer!.autoPlay;
    }

    set autoPlay(val: boolean) {
        this._players.forEach((other) => (other.autoPlay = val));
    }

    get simulated(): boolean {
        return false;
    }

    set simulated(val: boolean) {}

    ticker?: ((delta: number) => void) | undefined;

    get isLoading(): boolean {
        return this.masterPlayer!.isLoading;
    }

    get isPlaying(): boolean {
        return this.masterPlayer!.isPlaying;
    }

    get isPaused(): boolean {
        return this.masterPlayer!.isPaused;
    }

    play(
        options?:
            | string
            | {
                  url: string;
                  boot?: BootLike;
                  autoPlay?: boolean;
              }
    ): void {
        var _options: {
            url: string;
            boot?: BootLike;
            autoPlay?: boolean;
        } = { url: this.url, boot: undefined, autoPlay: true };
        if (options === undefined) {
        } else if (typeof options === "string") {
            _options.url = options;
        } else {
            _options.url = options.url;
            _options.boot = options.boot;
        }

        this._players.forEach((other) => other.play(_options));
    }

    onReady?: (() => void) | undefined;

    pause() {
        this._players.forEach((other) => other.pause());
    }

    stop() {
        this._players.forEach((other) => other.stop());
    }

    saveState(): PlayerSaveState {
        return this.masterPlayer!.saveState();
    }

    loadState(state?: PlayerSaveState) {
        this._players.forEach((other) => other.loadState(state));
    }

    _tickFromGame(delta: number) {
        this.tick(delta);
    }

    tick(delta: number) {
        const state = this.saveState();
        this._players.forEach((other) => {
            other.loadState(state);
            other.tick(delta);
        });
    }

    remove(): void {}

    resize(
        width:
            | { width?: number | string; height?: number | string }
            | number
            | string,
        height?: number | string
    ): void {
        if (typeof width === "object") {
            this._players.forEach((other) => other.resize(width));
        } else if (height !== undefined) {
            this._players.forEach((other) => other.resize(width, height));
        }
    }

    _handleReady() {
        if (this._players.every((other) => other.isPlaying)) {
            this.ready();
        }
    }

    ready() {
        if (this.onReady !== undefined) {
            this.onReady();
        }
    }

    addPlayer(other: IPlayer) {
        this._players.push(other);

        other.ticker =
            this._players.length === 1 ? this._tickFromGame : undefined;
        other.simulated = true;
        other.onReady = this._handleReady;
    }

    removePlayer(other: IPlayer) {
        const index = this._players.indexOf(other);
        if (index < 0) {
            return;
        }

        delete this._players[index];
        other.ticker = undefined;
        other.simulated = false;
    }

    getController(controllerId: number): IController | undefined {
        return this.masterPlayer!.getController(controllerId);
    }
}
