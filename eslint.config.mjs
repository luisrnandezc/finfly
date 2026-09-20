import cds from '@sap/cds/eslint.config.mjs';
import tseslint from 'typescript-eslint';

const typescriptFiles = [
  'srv/**/*.ts',
  'scripts/**/*.ts',
  'test/**/*.ts',
];

export default tseslint.config(
  ...cds.recommended,
  {
    name: 'finfly/typescript',
    files: typescriptFiles,
    extends: [tseslint.configs.recommended],
  },
  {
    name: 'finfly/scripts',
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    name: 'finfly/cap-handlers',
    files: ['srv/handlers/**/*.ts'],
    rules: {
      // CAP service entities are dynamic and draft shadow entities are not
      // represented completely by the generated TypeScript declarations.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    name: 'finfly/tests',
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
