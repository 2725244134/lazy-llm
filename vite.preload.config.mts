import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@shared-config': path.resolve(import.meta.dirname, './packages/shared-config'),
      '@shared-contracts': path.resolve(import.meta.dirname, './packages/shared-contracts'),
    },
  },
});
