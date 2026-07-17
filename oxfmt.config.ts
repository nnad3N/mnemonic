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
  ],
  sortImports: true,
  sortTailwindcss: {
    functions: ["cn", "clsx", "cva"],
    stylesheet: "./src/styles.css",
  },
});
