export default {
  extends: ['stylelint-config-standard', 'stylelint-config-css-modules'],
  ignoreFiles: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'],
  rules: {
    'selector-class-pattern': '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
    'selector-max-id': 0,
    // Component descendants and responsive variants intentionally share a cascade.
    // Their selectors are isolated by CSS Modules, not ordered across components.
    'no-descending-specificity': null,
  },
  overrides: [
    {
      files: ['src/app/styles/tailwind.css'],
      rules: {
        'import-notation': 'string',
        'at-rule-no-unknown': [true, { ignoreAtRules: ['theme'] }],
      },
    },
  ],
};
