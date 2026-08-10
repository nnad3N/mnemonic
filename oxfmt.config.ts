import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [
    "**/dist",
    "**/build",
    "**/out",
    "**/.output",
    "**/.vite",
    "**/.cache",
    "**/coverage",
    "**/*.gen.*",
    "**/*.generated.*",
    "**/src/lib/sandbox/modules/**",
    "**/src/_gt/**",
  ],
  sortImports: true,
  sortTailwindcss: {
    functions: ["cn", "clsx", "cva"],
    stylesheet: "./src/styles.css",
  },
});
