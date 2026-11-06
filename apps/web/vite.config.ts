import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@funspot/storage': path.resolve(__dirname, '../../packages/storage/src/web-entry.ts'),
    },
  },
  server: { host: '0.0.0.0', port: 3000 },
  preview: { host: '0.0.0.0' },
});