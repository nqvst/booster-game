import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Game logic that also runs in Node (tests, the dev server): no DOM.
const NO_DOM = ['src/sim/**', 'src/maps/parse.ts', 'src/editor/model.ts', 'src/snapshot.ts', 'src/remote-game.ts'];

export default [
  { ignores: ['dist/', '.claude/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // typescript-eslint turns no-undef off, but here it's what keeps the DOM out of NO_DOM files.
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { lib: ['esnext'] } },
    rules: { 'no-undef': 'error' },
  },
  { files: ['src/**/*.ts'], ignores: NO_DOM, languageOptions: { globals: globals.browser, parserOptions: { lib: ['esnext', 'dom', 'dom.iterable'] } } },
  { files: NO_DOM, languageOptions: { globals: globals['shared-node-browser'] } },
  { files: ['worker/**/*.ts'], languageOptions: { globals: globals.worker } },
  { files: ['test/**/*.ts', '*.config.*'], languageOptions: { globals: globals.node } },
  {
    // The sim is pure: same inputs → same state. No clock, no randomness, nothing from outside src/sim/.
    files: ['src/sim/**'],
    rules: {
      // Types are erased, so the sim may name types from elsewhere (GameMap, Config) without depending on that code.
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [{ regex: '^\\.\\./', allowTypeImports: true, message: 'src/sim/ imports only from src/sim/.' }] }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The sim is deterministic: no randomness.' },
        { object: 'Date', property: 'now', message: 'The sim is deterministic: use game.time.' },
        { object: 'performance', property: 'now', message: 'The sim is deterministic: use game.time.' },
      ],
    },
  },
  {
    rules: {
      // Size: force logic into small, named pieces.
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4],
      'complexity': ['error', 10],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],

      // Errors fail loud.
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'all' }],

      // Boring over clever.
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-nested-ternary': 'error',
      'no-param-reassign': 'error',
      '@typescript-eslint/no-shadow': 'error',
      'no-else-return': 'error',
      'consistent-return': 'error',
    },
  },
];
