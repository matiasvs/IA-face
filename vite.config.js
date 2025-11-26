import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/IA-face/', // Cambia esto al nombre de tu repositorio
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: 'index.html',
                imageTracking: 'image-tracking.html',
                compiler: 'compiler.html',
            },
        },
    },
})
