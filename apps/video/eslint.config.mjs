import { config } from "@remotion/eslint-config-flat";

const es6Rules = {
  "no-var": "error",
  "prefer-const": "error",
  "object-shorthand": ["error", "always"],
  "prefer-arrow-callback": "error",
  "prefer-template": "error",
  "no-useless-concat": "error",
  "no-duplicate-imports": "error",
  "func-style": ["error", "expression"],
};

export default [
  ...(Array.isArray(config) ? config : [config]),
  {
    rules: {
      ...es6Rules,
    },
  },
];
