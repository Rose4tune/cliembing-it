import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import unused from "eslint-plugin-unused-imports";
import testingLibrary from "eslint-plugin-testing-library";
import jestDom from "eslint-plugin-jest-dom";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    files: ["**/*.{ts,tsx,js,jsx}"],
    plugins: {
      react,
      "react-hooks": hooks,
      "unused-imports": unused,
      "testing-library": testingLibrary,
      "jest-dom": jestDom,
    },
    settings: { react: { version: "19" } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        vi: "readonly",
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      ...testingLibrary.configs.react.rules,
      ...jestDom.configs.recommended.rules,
    },
  },
  {
    ignores: [
      "node_modules",
      "dist",
      "build",
      ".next",
      ".turbo",
      "coverage",
      "storybook-static",
      "*.yaml",
      "*.yml",
      "tsconfig.json",
    ],
  },
];
