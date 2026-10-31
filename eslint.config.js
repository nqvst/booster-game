import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import project from './eslint-rules/index.js';

// Game logic that also runs in Node (tests, the dev server): no DOM.
const NO_DOM = ['src/sim/**', 'src/maps/parse.ts', 'src/art/props/boxes.ts', 'src/editor/model.ts', 'src/snapshot.ts', 'src/remote-game.ts'];

export default [
  { ignores: ['dist/', '.claude/', 'eslint-rules/', 'eslint.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // typescript-eslint turns no-undef off, but here it's what keeps the DOM out of NO_DOM files.
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { lib: ['esnext'], projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { project },
    rules: {
      'no-undef': 'error',

      // Needs types: a mishandled promise or a message type nobody handles is a bug, not a style issue.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      // Names and shapes a reader shouldn't need a comment for.
      'project/named-params': 'error',
      'project/no-braceless-nesting': 'error',
      'project/time-constant-units': 'error',
    },
  },
  { files: ['src/**/*.ts'], ignores: NO_DOM, languageOptions: { globals: globals.browser, parserOptions: { lib: ['esnext', 'dom', 'dom.iterable'] } } },
  { files: NO_DOM, languageOptions: { globals: globals['shared-node-browser'] } },
  { files: ['worker/**/*.ts'], languageOptions: { globals: globals.worker } },
  { files: ['test/**/*.ts', 'scripts/**/*.ts', '*.config.*'], languageOptions: { globals: globals.node } },
  {
    files: NO_DOM,
    rules: { 'project/no-dom-imports': ['error', { allowed: NO_DOM.map((glob) => glob.replace('/**', '')) }] },
  },
  {
    // The sim is pure: same inputs → same state. No clock, no randomness, nothing from outside src/sim/.
    files: ['src/sim/**'],
    rules: {
      // Types are erased, so the sim may name types from elsewhere (GameMap, Config) without depending on that code.
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [
        { regex: '^\\.\\./', allowTypeImports: true, message: 'src/sim/ imports only from src/sim/.' },
        { regex: '^[^.]', allowTypeImports: true, message: 'The sim has no dependencies.' },
      ] }],
      'no-restricted-globals': ['error', ...['Date', 'crypto', 'performance', 'fetch', 'setTimeout', 'setInterval'].map((name) => ({
        name,
        message: 'The sim is deterministic and self-contained: time comes from game.time, input through step().',
      }))],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The sim is deterministic: no randomness.' },
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
      'no-return-assign': ['error', 'always'],
      'default-param-last': 'error',
      'max-len': ['error', { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true, ignoreUrls: true }],

      // Nothing breaks these today. They keep it that way.
      'no-implicit-coercion': 'error',
      'no-sequences': 'error',
      'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
      'no-useless-assignment': 'error',
      'no-multi-assign': 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'no-throw-literal': 'error',
      'array-callback-return': 'error',
      'no-promise-executor-return': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
    },
  },
];
