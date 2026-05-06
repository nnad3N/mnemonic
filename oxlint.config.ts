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
  ],
  options: {
    typeAware: true,
  },
  overrides: [
    {
      files: ["**/*.{js,ts,tsx}"],
      jsPlugins: ["@stylistic/eslint-plugin"],
      rules: {
        "@stylistic/spaced-comment": "error",
      },
    },
  ],
  rules: {
    "arrow-body-style": "off",
    "import/no-commonjs": "error",
    "no-use-before-define": [
      "error",
      { allowNamedExports: true, functions: false },
    ],
    "typescript/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": false,
        "ts-ignore": "allow-with-description",
      },
    ],
    "typescript/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
    "typescript/strict-boolean-expressions": [
      "error",
      { allowNullableBoolean: true, allowNullableString: true },
    ],
  },
});
