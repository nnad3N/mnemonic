import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "oxc", "react", "import", "jsx-a11y", "vitest"],
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
  categories: {
    correctness: "error",
  },
  overrides: [
    {
      // Type-level Vitest tests assert via @ts-expect-error / expectTypeOf, not expect()
      files: ["**/*.test-d.ts"],
      rules: {
        "vitest/expect-expect": "off",
      },
    },
  ],
  rules: {
    "jsx-a11y/no-autofocus": "off",

    "import/no-commonjs": "error",
    "eslint-js/no-restricted-syntax": [
      "error",
      {
        selector: "CallExpression[callee.name='toSafeId']",
        message:
          "toSafeId is only allowed at validated backend boundaries; add an inline oxlint disable with a reason when branding raw IDs for Drizzle.",
      },
    ],
    "typescript/ban-ts-comment": [
      "error",
      {
        "ts-expect-error": false,
        "ts-ignore": "allow-with-description",
      },
    ],
    "typescript/consistent-type-definitions": ["error", "type"],
    "typescript/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/promise-function-async": "error",
    "typescript/require-await": "error",
    "typescript/strict-boolean-expressions": [
      "error",
      { allowNullableBoolean: true, allowNullableString: true },
    ],
    "typescript/switch-exhaustiveness-check": "error",
  },
});
