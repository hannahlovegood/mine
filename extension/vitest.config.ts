import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@engine': resolve(__dirname, '../src/engine'), '@app': resolve(__dirname, '../src') } },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
