import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // loading enviroment variables before running any tests
    setupFiles: ['dotenv/config'],
  },
});