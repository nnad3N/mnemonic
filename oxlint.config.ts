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
  ],
  options: {
    typeAware: true,
  },
  rules: {
    "arrow-body-style": "off",
    "eslint(sort-keys)": "off",
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
    "typescript/only-throw-error": [
      "error",
      {
        allow: [
          {
            from: "package",
            name: ["Redirect", "AnyRedirect"],
            package: "@tanstack/router-core",
          },
        ],
      },
    ],
    "typescript/strict-boolean-expressions": [
      "error",
      { allowNullableBoolean: true, allowNullableString: true },
    ],
    "typescript/strict-void-return": "off",
  },
});
