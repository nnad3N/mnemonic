import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const sharedResolve = {
  tsconfigPaths: true,
};

export default defineConfig({
  resolve: sharedResolve,
  test: {
    globals: false,
    projects: [
      {
        plugins: [viteReact()],
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "happy-dom",
          pool: "forks",
          // Node's own Web Storage globals make Vitest skip populating happy-dom's,
          // leaving `localStorage` undefined. https://github.com/vitest-dev/vitest/issues/8757
          execArgv: ["--no-webstorage"],
          maxWorkers: "50%",
          sequence: {
            groupOrder: 0,
          },
          // @platejs/math side-imports katex CSS; inline so Vite can stub it.
          server: {
            deps: {
              inline: ["@platejs/math"],
            },
          },
          globalSetup: ["./src/test/global-setup.ts"],
          setupFiles: ["./src/test/setup-db.ts", "./src/test/setup.ts"],
          exclude: ["**/*.browser.test.{ts,tsx}", "**/node_modules/**"],
        },
      },
      {
        plugins: [tailwindcss(), tanstackStart(), viteReact()],
        resolve: sharedResolve,
        optimizeDeps: {
          include: ["@testing-library/react"],
        },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./src/test/setup-browser.ts"],
          maxWorkers: 2,
          sequence: {
            groupOrder: 1,
          },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
