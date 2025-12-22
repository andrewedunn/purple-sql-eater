// ABOUTME: Vitest configuration for renderer process (browser/React) tests.
// ABOUTME: Tests React components, hooks, and browser-side utilities.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/renderer/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/renderer/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/test-setup.ts'],
    },
  },
});
