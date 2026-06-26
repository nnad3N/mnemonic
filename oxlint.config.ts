import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, vitest],
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
    "unicorn/prefer-ternary": "off",
    "unicorn/prefer-set-has": "off",
    "consistent-return": "off",
    "prefer-await-to-callbacks": "off",
    "func-names": "off",
    "prefer-destructuring": "off",
    "arrow-body-style": "off",
    "require-await": "off",
    "sort-keys": "off",
    "import/no-commonjs": "error",
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
