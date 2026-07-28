import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const nodeOsForTypescript = (): string => {
  if (Deno.build.os === "windows") {
    return "win32";
  }

  return Deno.build.os;
};

const nodeArchForTypescript = (): string => {
  switch (Deno.build.arch) {
    case "x86_64":
      return "x64";
    case "aarch64":
      return "arm64";
    default:
      return Deno.build.arch;
  }
};

/** Native `tsc` binary — Vitest's `.bin/tsc` shim needs Node, which Deno may lack. */
const resolveNativeTsc = (): string => {
  const root = import.meta.dirname;
  if (!root) {
    throw new Error("import.meta.dirname is required to resolve the TypeScript binary");
  }

  const platformPackage = `@typescript/typescript-${nodeOsForTypescript()}-${nodeArchForTypescript()}`;
  const typescriptDir = Deno.realPathSync(`${root}/node_modules/typescript`);
  const exeName = Deno.build.os === "windows" ? "tsc.exe" : "tsc";
  const exePath = `${typescriptDir}/../${platformPackage}/lib/${exeName}`;

  try {
    return Deno.realPathSync(exePath);
  } catch {
    throw new Error(`Native TypeScript binary not found at ${exePath}`);
  }
};

const sharedResolve = {
  tsconfigPaths: true,
};

const sharedTypecheck = {
  checker: resolveNativeTsc(),
} as const;

export default defineConfig({
  resolve: sharedResolve,
  test: {
    globals: false,
    typecheck: sharedTypecheck,
    projects: [
      {
        plugins: [viteReact()],
        resolve: sharedResolve,
        test: {
          name: "unit",
          environment: "happy-dom",
          pool: "forks",
          maxWorkers: "50%",
          sequence: {
            groupOrder: 0,
          },
          globalSetup: ["./src/test/global-setup.ts"],
          setupFiles: ["./src/test/setup-db.ts", "./src/test/setup.ts"],
          exclude: ["**/*.browser.test.{ts,tsx}", "**/node_modules/**"],
          typecheck: sharedTypecheck,
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
          typecheck: sharedTypecheck,
        },
      },
    ],
  },
});
