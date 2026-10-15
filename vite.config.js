import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `@/` is for UI code only (shadcn uses it). src/lib and api/ use relative `.js` imports,
    // because api/ runs on Vercel as plain Node ESM where Vite aliases don't exist.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
    environment: 'node',
  },
});
