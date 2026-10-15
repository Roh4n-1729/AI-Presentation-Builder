import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { localApi } from './scripts/vite-local-api.js';

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi()], // localApi: /api/* in `npm run dev` (D36)
  resolve: {
    // `@/` is for UI code only (shadcn uses it). src/lib and api/ use relative `.js` imports,
    // because api/ runs on Vercel as plain Node ESM where Vite aliases don't exist.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // no tests in api/: every file there would deploy as a function
    include: ['src/**/*.test.js', 'tests/**/*.test.js'],
    environment: 'node',
  },
});
