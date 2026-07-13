import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@asc/core-ast': resolve(__dirname, 'packages/core-ast/src/index.ts'),
      '@asc/core-sir': resolve(__dirname, 'packages/core-sir/src/index.ts'),
      '@asc/frontend-postman': resolve(__dirname, 'packages/frontend-postman/src/index.ts'),
      '@asc/passes': resolve(__dirname, 'packages/passes/src/index.ts'),
      '@asc/pipeline': resolve(__dirname, 'packages/pipeline/src/index.ts'),
      '@asc/cli': resolve(__dirname, 'packages/cli/src/index.ts'),
      '@asc/backend-axi': resolve(__dirname, 'packages/backend-axi/src/index.ts'),
      '@asc/backend-eval': resolve(__dirname, 'packages/backend-eval/src/index.ts'),
    },
  },
  test: {
    // Run tests in all packages
    include: ['packages/*/src/**/__tests__/**/*.test.ts'],
    // Enable snapshot testing (for golden fixture diffs)
    globals: false,
    environment: 'node',
    reporter: ['verbose'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/**/__tests__/**'],
    },
  },
});
