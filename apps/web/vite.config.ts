import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: 'next/navigation', replacement: path.resolve(rootDir, 'src/next-navigation.tsx') },
      { find: 'next/link', replacement: path.resolve(rootDir, 'src/next-link.tsx') },
      { find: '@', replacement: rootDir },
    ],
  },
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
