import { defineConfig } from 'vite';
// @ts-ignore
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config
export default defineConfig({
    plugins: [
        tailwindcss(),
    ],
});