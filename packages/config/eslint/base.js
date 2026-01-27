/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    rules: {
      "no-unused-vars": "off", // Turn off base rule
    },
    ignores: ["dist", ".next", "node_modules", "*.config.js", "*.config.mjs"],
  },
];
