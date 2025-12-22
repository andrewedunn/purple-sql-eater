// ABOUTME: Vitest configuration for main process (Node.js) unit tests.
// ABOUTME: Tests file system services, security utilities, and backend logic.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      exclude: ['**/*.test.ts'],
    },
  },
});
