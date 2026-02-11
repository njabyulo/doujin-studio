/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off", // Turn off base rule

      // ES6+ style rules
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "always"],
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "no-useless-concat": "error",
      "no-duplicate-imports": "error",

      // Prefer arrow functions over `function foo() {}` declarations.
      "func-style": ["error", "expression"],
    },
    ignores: [
      "dist/**",
      ".next/**",
      "node_modules/**",
      "*.config.js",
      "*.config.mjs",
    ],
  },
];
