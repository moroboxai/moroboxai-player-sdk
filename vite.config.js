import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    base: "/moroboxai-player-sdk/",
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
