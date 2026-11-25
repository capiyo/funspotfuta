import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const rootDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: path.resolve(rootDir, 'app'),
  base: '/app/',
  publicDir: path.resolve(rootDir, 'public'),
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(rootDir, 'src') } },
  server: { host: '0.0.0.0', fs: { allow: [rootDir] } },
  build: {
    outDir: path.resolve(rootDir, 'dist/app'),
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { input: path.resolve(rootDir, 'app/index.html') },
  },
});
