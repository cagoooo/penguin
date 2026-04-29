import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Limit to in-source tests; the `e2e/` directory uses Playwright instead.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
