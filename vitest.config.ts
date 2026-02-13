import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'archive_debug_scripts/',
        '.next/',
        'vitest.config.ts',
        'vitest.setup.ts',
        '**/*.d.ts',
        '**/*.config.ts',
        'prisma/',
      ],
    },
    deps: {
      // Mark optional dependencies as external to prevent bundling errors
      external: ['@vercel/blob', '@aws-sdk/client-s3'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
