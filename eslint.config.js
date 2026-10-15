import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

// Relative imports must name the file: api/ (and the src/lib it imports) run as plain Node ESM
// on Vercel, where './layout' without '.js' fails to resolve.
const explicitExtension = {
  regex: '^\\.{1,2}/(?!.*\\.(js|json)$)',
  message: 'Use an explicit .js extension (this code also runs as plain Node ESM in /api).',
};
const noReactOrUi = {
  group: [
    'react',
    'react-dom',
    'react/*',
    'react-dom/*',
    'zustand',
    'zustand/*',
    'react-*',
    'recharts',
    '@dnd-kit/*',
  ],
  message: 'src/lib and api/ are pure JS shared by browser and server: no React or UI libraries.',
};
const noAlias = {
  group: ['@/*'],
  message: 'The @/ alias only exists in Vite. Use a relative import with .js here.',
};

export default defineConfig([
  globalIgnores(['dist', 'coverage', '.vercel', 'node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.jsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // shadcn-generated components export helpers (e.g. buttonVariants) next to components.
    files: ['src/primitives/ui/**/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['api/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // ---- Layer rules (see CLAUDE.md / docs/ARCHITECTURE.md) ----
  {
    // lib/ is pure: no React, no UI libs, no upward imports, explicit extensions.
    files: ['src/lib/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noReactOrUi,
            noAlias,
            explicitExtension,
            {
              group: [
                '**/store/**',
                '**/features/**',
                '**/hooks/**',
                '**/services/**',
                '**/primitives/**',
                '**/screens/**',
              ],
              message: 'src/lib must not import from upper layers.',
            },
          ],
        },
      ],
    },
  },
  {
    // api/ may import only src/lib (plus npm packages like ai, zod).
    files: ['api/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noReactOrUi,
            noAlias,
            explicitExtension,
            {
              group: ['../src/**', '!../src/lib', '!../src/lib/**'],
              message: 'api/ may import only from src/lib.',
            },
          ],
        },
      ],
    },
  },
]);
