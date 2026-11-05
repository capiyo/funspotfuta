import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const rootDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({ base: '/app/', plugins: [react()],
  resolve: { alias: { '@': path.resolve(rootDir, 'src') } }, server: { host: '0.0.0.0' },
  build: { rollupOptions: { input: { app: path.resolve(rootDir, 'app/index.html') } } },
});
