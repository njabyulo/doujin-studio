/** @type {import("eslint").Linter.Config} */
const baseConfig = require("./base.js");

/** @type {import("eslint").Linter.Config} */
module.exports = {
  ...baseConfig,
  extends: [
    ...(Array.isArray(baseConfig.extends)
      ? baseConfig.extends
      : [baseConfig.extends]),
    "next/core-web-vitals",
    "next/typescript",
  ],
  rules: {
    ...baseConfig.rules,
    "@next/next/no-html-link-for-pages": "off",
  },
};
