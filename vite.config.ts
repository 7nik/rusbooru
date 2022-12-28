import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        target: "esnext",
    },
    plugins: [
        svelte(),
        monkey({
            entry: "src/main.ts",
            build: {
                metaFileName: true,
            },
            userscript: {
                namespace: "7nik",
                icon: "https://danbooru.donmai.us/favicon.svg",
                homepageURL: "https://github.com/7nik/rusbooru",
                supportURL: "https://github.com/7nik/rusbooru/issues",
                updateURL: "https://github.com/7nik/rusbooru/releases/latest/download/rusbooru.meta.js",
                downloadURL: "https://github.com/7nik/rusbooru/releases/latest/download/rusbooru.user.js",
                match: [
                    "https://*.donmai.us/*",
                    "https://aibooru.online/*",
                ],
                connect: "anime-pictures.net",
            },
        }),
    ],
});
