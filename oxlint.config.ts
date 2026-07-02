import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, vitest],
  jsPlugins: [{ name: "eslint-js", specifier: "oxlint-plugin-eslint" }],
  ignorePatterns: [
    "**/.nx/**",
    "**/snap/**",
    "**/vite.config.*.timestamp-*.*",
    "**.gen.ts",
    "**/src/components/ui/**",
    "**/src/components/assistant-ui/**",
  ],
  options: {
    typeAware: true,
  },
  rules: {
    "no-inline-comments": "off",
    "unicorn/prefer-spread": "off",
    "unicorn/prefer-ternary": "off",
    "unicorn/prefer-set-has": "off",
    "consistent-return": "off",
    "prefer-await-to-callbacks": "off",
    "promise/prefer-await-to-then": "off",
    "func-names": "off",
    "prefer-destructuring": "off",
    "arrow-body-style": "off",
    "require-await": "off",
    "sort-keys": "off",
    "import/no-commonjs": "error",
    "eslint-js/no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='toSafeId']",
        message:
          "toSafeId is only allowed at validated backend boundaries; add an inline oxlint disable with a reason when branding raw IDs for Drizzle.",
      },
    ],
    "no-use-before-define": "allow",
    "typescript/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": false,
        "ts-ignore": "allow-with-description",
      },
    ],
    "typescript/consistent-type-definitions": ["error", "type"],
    "typescript/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
    "typescript/only-throw-error": "off",
    "typescript/strict-boolean-expressions": [
      "error",
      { allowNullableBoolean: true, allowNullableString: true },
    ],
    "typescript/strict-void-return": "off",
  },
});
