import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Os testes usam o código-fonte dos pacotes internos, sem exigir build antes.
    alias: [
      {
        find: /^@fraglens\/([a-z-]+)$/,
        replacement: resolve(import.meta.dirname, 'packages/$1/src/index.ts'),
      },
    ],
  },
  test: {
    include: ['apps/*/test/**/*.test.ts', 'packages/*/test/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
