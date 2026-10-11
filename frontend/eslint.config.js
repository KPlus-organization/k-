import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
import a11y from 'eslint-plugin-jsx-a11y';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

export default defineConfig([
  globalIgnores(['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/root-path': import.meta.dirname,
      'boundaries/elements': layers.map((layer) => ({
        type: layer,
        pattern: layer === 'app' ? 'src/app' : `src/${layer}/*`,
        capture: layer === 'app' ? [] : ['slice'],
      })),
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: layers.map((layer, index) => ({
            from: { element: { type: layer } },
            allow: {
              to: {
                element: {
                  type: layer === 'shared' ? ['shared'] : layers.slice(index + 1),
                  fileInternalPath: 'index.ts',
                },
              },
            },
            message:
              'FSD: use the public index.ts of a lower layer; sibling slices cannot import one another.',
          })),
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [hooks.configs.flat.recommended, refresh.configs.vite, a11y.flatConfigs.recommended],
  },
  prettier,
]);
