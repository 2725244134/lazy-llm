import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared-config': path.resolve(import.meta.dirname, './packages/shared-config'),
      '@shared-contracts': path.resolve(import.meta.dirname, './packages/shared-contracts'),
    },
  },
});
