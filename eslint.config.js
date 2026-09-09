/*
 * What the linter is here for.
 *
 * Most of this project's real defects have been the same two shapes: a
 * hook that reads something it did not declare, so it keeps returning an
 * answer from a render ago; and a name that no longer exists, or exists
 * twice. Neither is visible by reading, both are trivial for a machine.
 *
 * So the rules are deliberately few. Every one below is either a mistake
 * that cannot be intentional, or a dependency the code is lying about.
 * Style is not the point and is left alone.
 */

import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**", "tests/.smoke-build/**", "tests/.cards-build/**"] },

  /* The app: a browser, React, ES modules. */
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        /* Stamped into the bundle at build time by vite.config.js, so the
           corner menu can say which build it is running. */
        __APP_RELEASE__: "readonly",
        __APP_VERSION__: "readonly",
        __BUILT_AT__: "readonly",
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "18.3" } },
    rules: {
      ...js.configs.recommended.rules,

      /* The two that matter most. A hook called conditionally is always a
         bug; a dependency array that does not mention what the hook reads
         is how a screen ends up showing a value from a render ago. */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      /* JSX counts as using a name, or every component import looks dead. */
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",

      /* Dead imports and dead locals. Arguments are exempt: a handler that
         ignores its event is normal, and so is a placeholder before a
         parameter that is used. */
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],

      /* Mistakes that cannot be deliberate. */
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-dupe-class-members": "error",
      "no-duplicate-case": "error",
      "no-unsafe-negation": "error",
      "no-unreachable": "error",
      "no-fallthrough": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],

      /* An empty catch is how a failure becomes a screen that looks fine.
         Where one is genuinely right, a comment inside it says so — and
         this rule accepts that, so the reason has to be written down. */
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  /* The server: Node, no React, no DOM. */
  {
    files: ["server/**/*.js", "scripts/**/*.mjs", "*.config.js", "vite.config.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-empty": ["error", { allowEmptyCatch: false }],
    },
  },

  /* The tests: Node plus a jsdom window the smoke harness installs. */
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      eqeqeq: ["error", "always", { null: "ignore" }],
    },
  },
];
