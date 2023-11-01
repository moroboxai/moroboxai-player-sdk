import Spinner from "./spinner";

export interface IOverlay {
    show(): void;
    hide(): void;
    mouseEnter(): void;
    mouseMove(): void;
    mouseLeave(): void;
}

class OverlayDiv {
    el: HTMLElement;

    get style(): CSSStyleDeclaration {
        return this.el.style;
    }

    constructor(root: HTMLElement) {
        this.el = document.createElement("div");
        this.el.style.width = "100%";
        this.el.style.height = "100%";
        this.el.style.position = "absolute";
        this.el.style.left = "0";
        this.el.style.top = "0";
        this.el.style.display = "flex";
        this.el.style.flexDirection = "column";
        this.el.style.justifyContent = "center";
        this.el.style.alignItems = "center";
        root.appendChild(this.el);
    }

    show() {
        this.el.style.display = "flex";
    }

    hide() {
        this.el.style.display = "none";
    }

    remove() {
        this.el.remove();
    }
}

class PlayOverlayDiv implements IOverlay {
    private _overlay: OverlayDiv;
    private _input: HTMLInputElement;
    onPlay?: () => void;

    constructor(root: HTMLElement) {
        this._overlay = new OverlayDiv(root);
        this._input = document.createElement("input");
        this._input.type = "button";
        this._input.value = "Play";
        this._input.onclick = () => {
            if (this.onPlay) {
                this.onPlay();
            }
        };
        this._overlay.el.appendChild(this._input);
        root.appendChild(this._overlay.el);
    }

    show() {
        this._overlay.show();
    }

    hide() {
        this._overlay.hide();
    }

    mouseEnter() {}

    mouseMove() {}

    mouseLeave() {}

    remove() {
        this._overlay.remove();
    }
}

class LoadingOverlayDiv implements IOverlay {
    private _overlay: OverlayDiv;

    constructor(root: HTMLElement) {
        this._overlay = new OverlayDiv(root);
        this._overlay.style.backgroundColor = "black";
        new Spinner(this._overlay.el);
        root.appendChild(this._overlay.el);
    }

    show() {
        this._overlay.show();
    }

    hide() {
        this._overlay.hide();
    }

    mouseEnter() {}

    mouseMove() {}

    mouseLeave() {}

    remove() {
        this._overlay.remove();
    }
}

class SettingsOverlayDiv implements IOverlay {
    private _overlay: OverlayDiv;
    private _speed1: HTMLInputElement;
    private _speed2: HTMLInputElement;
    private _speed4: HTMLInputElement;
    onSpeed?: (value: number) => void;

    constructor(root: HTMLElement) {
        this._overlay = new OverlayDiv(root);
        this._speed1 = document.createElement("input");
        this._speed1.type = "button";
        this._speed1.value = "x1";
        this._speed1.onclick = () => {
            if (this.onSpeed) {
                this.onSpeed(1);
            }
        };
        this._speed2 = document.createElement("input");
        this._speed2.type = "button";
        this._speed2.value = "x2";
        this._speed2.onclick = () => {
            if (this.onSpeed) {
                this.onSpeed(2);
            }
        };
        this._speed4 = document.createElement("input");
        this._speed4.type = "button";
        this._speed4.value = "x4";
        this._speed4.onclick = () => {
            if (this.onSpeed) {
                this.onSpeed(4);
            }
        };
        this._overlay.el.appendChild(this._speed1);
        this._overlay.el.appendChild(this._speed2);
        this._overlay.el.appendChild(this._speed4);
        this._overlay.hide();
        root.appendChild(this._overlay.el);
    }

    playing(): void {}

    paused(): void {}

    show() {
        this._overlay.show();
    }

    hide() {
        this._overlay.hide();
    }

    mouseEnter() {
        this.show();
    }

    mouseMove() {}

    mouseLeave() {
        this.hide();
    }

    remove() {
        this._overlay.remove();
    }
}

export class Overlay implements IOverlay {
    // Called when the play button is clicked
    onPlay?: () => void;
    // Called when the game speed is selected
    onSpeed?: (value: number) => void;

    private _root: HTMLElement;
    private _playOverlay: PlayOverlayDiv;
    private _loadingOverlay: LoadingOverlayDiv;
    private _settingsOverlay: SettingsOverlayDiv;
    private _selectedOverlay: IOverlay;

    constructor(root: HTMLElement) {
        this._root = root;

        this._playOverlay = new PlayOverlayDiv(root);
        this._selectedOverlay = this._playOverlay;
        this._playOverlay.onPlay = () => {
            if (this.onPlay) {
                this.onPlay();
            }
        };

        this._loadingOverlay = new LoadingOverlayDiv(this._root);
        this._loadingOverlay.hide();

        this._settingsOverlay = new SettingsOverlayDiv(this._root);
        this._settingsOverlay.hide();
        this._settingsOverlay.onSpeed = (value: number) => {
            if (this.onSpeed) {
                this.onSpeed(value);
            }
        };
    }

    // Called when the game is stopped
    stopped() {
        this._selectedOverlay.hide();
        this._selectedOverlay = this._playOverlay;
        this._playOverlay.show();
    }

    // Called when the game is loading
    loading() {
        this._playOverlay.hide();
        this._selectedOverlay = this._loadingOverlay;
        this._loadingOverlay.show();
    }

    // Called when the game is playing
    playing() {
        this._loadingOverlay.hide();
        this._selectedOverlay = this._settingsOverlay;
        this._settingsOverlay.hide();
        this._settingsOverlay.playing();
    }

    // Called when the game is playing
    paused() {
        this._settingsOverlay.paused();
    }

    show(): void {}

    hide(): void {}

    mouseEnter() {
        this._selectedOverlay.mouseEnter();
    }

    mouseMove() {
        this._selectedOverlay.mouseMove();
    }

    mouseLeave() {
        this._selectedOverlay.mouseLeave();
    }

    remove() {
        this._playOverlay.remove();
        this._loadingOverlay.remove();
        this._settingsOverlay.remove();
    }
}

export default Overlay;
