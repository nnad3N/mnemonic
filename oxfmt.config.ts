import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  sortTailwindcss: {
    functions: ["cn", "clsx", "cva"],
    stylesheet: "./src/styles.css",
  },
});
