import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/tests/electron/**',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared-config': resolve(__dirname, 'packages/shared-config'),
      '@shared-contracts': resolve(__dirname, 'packages/shared-contracts'),
    },
  },
});
