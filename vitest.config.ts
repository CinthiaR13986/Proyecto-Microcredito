import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,   // llamadas al servidor MCP
    hookTimeout: 60000,   // beforeAll que levanta el servidor
    coverage: {
      provider: 'v8',
      include: ['src/dominio/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});