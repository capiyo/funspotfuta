import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(rootDir, 'src') },
  },
  build: {
    ssr: path.resolve(rootDir, 'src/entry-server.tsx'),
    outDir: path.resolve(rootDir, 'dist-ssr'),
    emptyOutDir: true,
  },
});
