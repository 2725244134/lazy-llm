import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      // Exclude Playwright tests
      '**/tests/electron/**',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
