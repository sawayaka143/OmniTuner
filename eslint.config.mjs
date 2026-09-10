// Flat ESLint config — Angular 22 (standalone + signals).
// TS configs apply to .ts files, template configs to .html files (including inline templates).
// Prettier runs separately (npm run format) — conflicts disabled via eslint-config-prettier.
import ts from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier';

const TS_FILES = ['**/*.ts'];
const HTML_FILES = ['**/*.html'];

export default ts.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'out-tsc/',
      'coverage/',
      '.commandcode/',
      'tests/',
      'android/',
    ],
  },
  ...ts.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: TS_FILES,
  })),
  ...angular.configs.tsRecommended.map((config) => ({
    ...config,
    files: TS_FILES,
  })),
  ...angular.configs.templateRecommended.map((config) => ({
    ...config,
    files: HTML_FILES,
  })),
  ...angular.configs.templateAccessibility.map((config) => ({
    ...config,
    files: HTML_FILES,
  })),
  {
    files: TS_FILES,
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['capacitor.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Outputs named like native DOM events (`change`, `click`) are an
      // intentional pattern across the `ui/` primitives.
      '@angular-eslint/no-output-native': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', 'src/test-setup.ts'],
    rules: {
      // jsdom dialog stubs assign prototype methods; fine for tests.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: HTML_FILES,
    rules: {
      // Click-outside-to-dismiss and `stopPropagation` handlers live on
      // non-focusable containers and panels by design — the focusable target
      // is always a real button or link inside them.
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
    },
  },
  prettier,
);
