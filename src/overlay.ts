import {Spinner} from './spinner'

class OverlayDiv {
    el: HTMLElement;

    get style(): CSSStyleDeclaration {
        return this.el.style;
    }

    constructor(root: HTMLElement) {
        this.el = document.createElement('div');
        this.el.style.width = '100%';
        this.el.style.height = '100%';
        this.el.style.position = 'absolute';
        this.el.style.left = '0';
        this.el.style.top = '0';
        this.el.style.display = 'flex';
        this.el.style.flexDirection = 'column';
        this.el.style.justifyContent = 'center';
        this.el.style.alignItems = 'center';
        root.appendChild(this.el);
    }

    show() {
        this.el.style.display = 'flex';
    }

    hide() {
        this.el.style.display = 'none';
    }

    remove() {
        this.el.remove();
    }
}

class PlayOverlayDiv {
    private _overlay: OverlayDiv;
    private _input: HTMLInputElement;
    onPlay?: () => void;

    constructor(root: HTMLElement) {
        this._overlay = new OverlayDiv(root);
        this._input = document.createElement('input');
        this._input.type = 'button';
        this._input.value = 'Play';
        this._input.onclick = () => {
            if (this.onPlay) {
                this.onPlay();
            }
        };
        this._overlay.el.appendChild(this._input);
        root.appendChild(this._overlay.el);
    }

    remove() {
        this._overlay.remove();
    }
}

class LoadingOverlayDiv {
    private _overlay: OverlayDiv;

    constructor(root: HTMLElement) {
        this._overlay = new OverlayDiv(root);
        this._overlay.style.backgroundColor = 'black';
        new Spinner(this._overlay.el);
        root.appendChild(this._overlay.el);
    }

    remove() {
        this._overlay.remove();
    }
}

class SettingsOverlayDiv {
    private _overlay: OverlayDiv;
    private _speed1: HTMLInputElement;
    private _speed2: HTMLInputElement;
    private _speed4: HTMLInputElement;
    onSpeed?: (value: number) => void;

    constructor(root: HTMLElement) {
        this._overlay = new OverlayDiv(root);
        this._speed1 = document.createElement('input');
        this._speed1.type = 'button';
        this._speed1.value = 'x1';
        this._speed1.onclick = () => {
            if (this.onSpeed) {
                this.onSpeed(1);
            }
        };
        this._speed2 = document.createElement('input');
        this._speed2.type = 'button';
        this._speed2.value = 'x2';
        this._speed2.onclick = () => {
            if (this.onSpeed) {
                this.onSpeed(2);
            }
        };
        this._speed4 = document.createElement('input');
        this._speed4.type = 'button';
        this._speed4.value = 'x4';
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

    mouseEnter() {
        this._overlay.show();
    }

    mouseMove() {
    }

    mouseLeave() {
        this._overlay.hide();
    }

    remove() {
        this._overlay.remove();
    }
}

export class Overlay {
    // Called when the play button is clicked
    onPlay?: () => void;
    // Called when the game speed is selected
    onSpeed?: (value: number) => void;

    private _root: HTMLElement;
    private _playOverlay?: PlayOverlayDiv;
    private _loadingOverlay?: LoadingOverlayDiv;
    private _settingsOverlay?: SettingsOverlayDiv;

    constructor(root: HTMLElement) {
        this._root = root;
        this._playOverlay = new PlayOverlayDiv(root);
        this._playOverlay.onPlay = () => {
            if (this.onPlay) {
                this.onPlay();
            }
        };
    }

    // Called when the game is loading
    loading() {
        this.remove();

        this._loadingOverlay = new LoadingOverlayDiv(this._root);
    }

    // Called when the game is ready
    ready() {
        this.remove();

        this._settingsOverlay = new SettingsOverlayDiv(this._root);
        this._settingsOverlay.onSpeed = (value: number) => {
            if (this.onSpeed) {
                this.onSpeed(value);
            }
        };
    }

    mouseEnter() {
        if (this._settingsOverlay) {
            this._settingsOverlay.mouseEnter();
        }
    }

    mouseMove() {
        if (this._settingsOverlay) {
            this._settingsOverlay.mouseMove();
        }
    }

    mouseLeave() {
        if (this._settingsOverlay) {
            this._settingsOverlay.mouseLeave();
        }
    }

    remove() {
        if (this._playOverlay) {
            this._playOverlay.remove();
            this._playOverlay = undefined;
        }

        if (this._loadingOverlay) {
            this._loadingOverlay.remove();
            this._loadingOverlay = undefined;
        }

        if (this._settingsOverlay) {
            this._settingsOverlay.remove();
            this._settingsOverlay = undefined;
        }
    }
}