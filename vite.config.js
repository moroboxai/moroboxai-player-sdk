import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    base: "/moroboxai-player-sdk/",
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    }
});
