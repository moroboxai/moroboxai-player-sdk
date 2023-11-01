import type { StretchMode } from "@player/types";
import Overlay from "./overlay";

export interface UIOptions {
    // Root element
    element: HTMLElement;
    // Stretch mode for the player
    stretchMode?: StretchMode;
    // Callback for when play button is clicked
    onPlay: () => void;
    // Callback for when selecting a speed
    onSpeedSelected: (value: number) => void;
}

class UI {
    readonly gameRoot: HTMLElement;
    private readonly _options: UIOptions;
    private readonly _wrapper: HTMLElement;
    private readonly _overlay: Overlay;

    constructor(options: UIOptions) {
        this._options = options;

        // Create the global wrapper
        {
            let div = document.createElement("div");
            this._wrapper = div;
            div.addEventListener("mouseenter", () => this._onMouseEnter());
            div.addEventListener("mousemove", () => this._onMouseMove());
            div.addEventListener("mouseleave", () => this._onMouseLeave());
            if (this._options.stretchMode === "fill") div.style.width = "100%";
            div.style.height = "100%";
            div.style.position = "relative";
            div.style.backgroundPosition = "center";
            div.style.backgroundSize = "cover";
            div.style.backgroundColor = "black";

            this._options.element.appendChild(div);
        }

        {
            let div = document.createElement("div");
            this.gameRoot = div;
            div.style.width = "100%";
            div.style.height = "100%";
            div.style.position = "absolute";
            div.style.left = "0";
            div.style.top = "0";
            div.style.display = "flex";
            div.style.flexDirection = "row";
            div.style.justifyContent = "center";
            this._wrapper.appendChild(div);
        }

        {
            this._overlay = new Overlay(this._wrapper);
            this._overlay.onPlay = () => this._options.onPlay();
            this._overlay.onSpeed = (value: number) =>
                this._options.onSpeedSelected(value);
        }
    }

    /**
     * Get width of the UI.
     */
    get width(): number {
        return this._wrapper.clientWidth;
    }

    /**
     * Get height of the UI.
     */
    get height(): number {
        return this._wrapper.clientHeight;
    }

    set backgroundImage(value: string | undefined) {
        this._wrapper.style.backgroundImage = value ?? "";
    }

    private _onMouseEnter() {
        if (this._overlay) {
            this._overlay.mouseEnter();
        }
    }

    private _onMouseMove() {
        if (this._overlay) {
            this._overlay.mouseMove();
        }
    }

    private _onMouseLeave() {
        if (this._overlay) {
            this._overlay.mouseLeave();
        }
    }

    playing() {
        this._overlay.playing();
    }

    paused() {
        this._overlay.paused();
    }

    stopped() {
        this._overlay.stopped();
    }

    loading() {
        this._overlay.loading();
    }

    resize(options: {
        width?: number | string;
        height?: number | string;
        aspectRatio: string;
    }) {
        const { width, height, aspectRatio } = options;
        this._wrapper.style.aspectRatio = aspectRatio;

        const rootElement = this._options.element;
        if (typeof width === "number") {
            rootElement.style.width = `${Math.round(width)}px`;
        } else if (typeof width === "string") {
            rootElement.style.width = width;
        }

        if (typeof height === "number") {
            rootElement.style.height = `${Math.round(height)}px`;
        } else if (typeof height === "string") {
            rootElement.style.height = height;
        }
    }

    remove() {
        this._overlay.remove();
        this._wrapper.remove();
    }
}

export default UI;
