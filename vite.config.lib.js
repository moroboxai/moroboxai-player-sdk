import { defineConfig } from "vite";
import { version } from "./package.json";
import path, { resolve } from "path";

export default defineConfig({
    define: {
        __VERSION__: version
    },
    build: {
        outDir: resolve(__dirname, "lib"),
        lib: {
            entry: resolve(__dirname, "src", "index.ts"),
            name: "MoroboxAIPlayerSDK",
            formats: ["cjs", "es", "umd"],
            fileName: (format) => {
                switch (format) {
                    case "cjs":
                        return `cjs/index.cjs`;
                    case "es":
                        return `es/index.js`;
                    case "umd":
                        return `umd/moroboxai-player-sdk.min.js`;
                }
            }
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@agent": path.resolve(__dirname, "./src/agent"),
            "@controller": path.resolve(__dirname, "./src/controller"),
            "@player": path.resolve(__dirname, "./src/player"),
            "@plugin": path.resolve(__dirname, "./src/plugin"),
            "@ui": path.resolve(__dirname, "./src/ui"),
            "@utils": path.resolve(__dirname, "./src/utils")
        }
    }
});
