import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const nodeOsForTypescript = (): string => {
  switch (Deno.build.os) {
    case "windows":
      return "win32";
    default:
      return Deno.build.os;
  }
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

/**
 * TypeScript 7 ships a native `tsc` binary via `@typescript/typescript-<os>-<arch>`.
 * Vitest's default checker resolves `node_modules/.bin/tsc`, which is a Node shebang
 * shim around that binary — fine under Node, fragile under Deno when `node` is not on
 * PATH. Pointing `typecheck.checker` at the native executable matches what the shim
 * would exec, without needing Node.
 */
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

export default defineConfig({
  // Intentionally lean: do not load tanstackStart / nitro / babel / tailwind /
  // devtools here. Those belong to the app Vite config; each Vitest fork under
  // Deno is a full `deno run` process, so unused plugins multiply RSS for nothing.
  plugins: [viteReact()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "happy-dom",
    pool: "forks",
    // Deno cannot use `pool: "threads"` for this suite yet (node-compat
    // `ERR_NOT_IMPLEMENTED`, and DATABASE_URL is bound at module import time).
    // Forks default to one worker per CPU; on a 20-core / 16GB WSL VM that
    // already hosts the IDE, that oversubscribes memory. Vitest documents
    // percentage caps for high-core hosts — half the CPUs is enough parallelism
    // for this suite and keeps peak RSS off the OOM cliff.
    maxWorkers: "50%",
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup-db.ts", "./src/test/setup.ts"],
    globals: false,
    typecheck: {
      checker: resolveNativeTsc(),
    },
  },
});
