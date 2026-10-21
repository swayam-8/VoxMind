import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 180000,
    testTimeout: 30000,
    environment: 'node',
  },
});
