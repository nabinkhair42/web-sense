module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended"],
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "prefer-const": "error",
    "no-var": "error",
    "no-undef": "error",
  },
  env: {
    node: true,
    es2022: true,
    browser: true,
  },
  ignorePatterns: ["dist/", "node_modules/"],
};
