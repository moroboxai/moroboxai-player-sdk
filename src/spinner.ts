class SpinnerChild {
    private _el: HTMLElement;

    constructor(root: HTMLElement, animationDelay?: number) {
        this._el = document.createElement("div");
        this._el.style.boxSizing = "border-box";
        this._el.style.display = "block";
        this._el.style.position = "absolute";
        this._el.style.width = "32px";
        this._el.style.height = "32px";
        this._el.style.margin = "4px";
        this._el.style.border = "4px solid #fff";
        this._el.style.borderRadius = "50%";
        this._el.style.animation =
            "moroboxai-spinner-rotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite";
        this._el.style.borderColor = "#fff transparent transparent transparent";
        if (animationDelay !== undefined) {
            this._el.style.animationDelay = `-${animationDelay}s`;
        }
        root.appendChild(this._el);
    }
}

export class Spinner {
    private _el: HTMLElement;

    constructor(root: HTMLElement) {
        this._el = document.createElement("div");
        this._el.style.display = "inline-block";
        this._el.style.position = "relative";
        this._el.style.width = "40px";
        this._el.style.height = "40px";
        new SpinnerChild(this._el, 0.45);
        new SpinnerChild(this._el, 0.3);
        new SpinnerChild(this._el, 0.15);
        new SpinnerChild(this._el);
        root.appendChild(this._el);

        let style = document.getElementById("moroboxai-dynamic-style");
        if (!style) {
            style = document.createElement("style");
            style.id = "moroboxai-dynamic-style";
            document.body.appendChild(style);
        }

        style.innerHTML =
            "@keyframes moroboxai-spinner-rotate {\n" +
            "   0% {\n" +
            "      transform: rotate(0deg);\n" +
            "   }\n" +
            "   100% {\n" +
            "      transform: rotate(360deg);\n" +
            "   }\n" +
            "}";
    }

    remove() {
        this._el.remove();
    }
}
