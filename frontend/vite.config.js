import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    define: {
        // Expose select env vars to the client (only those with VITE_ prefix are auto-exposed)
        'process.env': {},
    },
    server: {
        port: 5173,
        host: true,
    },
    build: {
        target: 'es2022',
        sourcemap: true,
    },
});
