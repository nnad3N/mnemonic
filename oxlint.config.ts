import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["eslint", "typescript", "oxc", "react", "import", "jsx-a11y", "vitest"],
  jsPlugins: [
    { name: "eslint-js", specifier: "oxlint-plugin-eslint" },
    { name: "gt", specifier: "@generaltranslation/react-core-linter" },
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
  ],
  ignorePatterns: [
    "**/.nx/**",
    "**/snap/**",
    "**/vite.config.*.timestamp-*.*",
    "**.gen.ts",
    "**/src/components/ui/**",
    "**/src/components/assistant-ui/**",
    "**/src/lib/sandbox/modules/**",
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".continue/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
    "tools/oxlint/anti-slop/**",
  ],
  options: {
    typeAware: true,
  },
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  overrides: [
    {
      // Type-level Vitest tests assert via @ts-expect-error / expectTypeOf, not expect()
      files: ["**/*.test-d.ts"],
      rules: {
        "vitest/expect-expect": "off",
      },
    },
    {
      files: ["**/*.{test,test-d}.{ts,tsx}"],
      rules: {
        "eslint-js/no-restricted-syntax": "off",
        "anti-slop/require-safety-comment-for-type-assertion": "off",
      },
    },
  ],
  rules: {
    "vitest/expect-expect": [
      "error",
      {
        assertFunctionNames: ["expect", "expect*", "assert*"],
      },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "gt/static-jsx": ["error", { libs: ["gt-tanstack-start"] }],
    "gt/static-string": ["error", { libs: ["gt-tanstack-start"] }],
    "gt/no-data-attrs-on-branch": ["error", { libs: ["gt-tanstack-start"] }],
    "typescript/consistent-return": "off",
    "no-shadow": "off",
    "react/react-in-jsx-scope": "off",
    "jsx-a11y/no-autofocus": "off",
    "jsx-a11y/control-has-associated-label": "off",
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
    "typescript/no-unnecessary-condition": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/promise-function-async": "error",
    "typescript/require-await": "error",
    "typescript/strict-boolean-expressions": [
      "error",
      {
        allowNullableBoolean: true,
        allowNullableString: true,
        allowNullableNumber: false,
        allowNumber: false,
      },
    ],
    "typescript/switch-exhaustiveness-check": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
  },
});
