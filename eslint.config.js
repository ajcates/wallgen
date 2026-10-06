import js from '@eslint/js';

export default [
  {
    ignores: ['tests/tmp/**', 'mandala-atlas/**']
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['warn', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
        'caughtErrorsIgnorePattern': '^_'
      }],
      'no-undef': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'no-empty': 'warn'
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        Math: 'readonly',
        Path2D: 'readonly',
        module: 'readonly',
        __dirname: 'readonly'
      }
    }
  },
  {
    files: ['web/public/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        requestAnimationFrame: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly'
      }
    }
  }
];
