import { cleanup } from "@testing-library/react";
import { enableMapSet } from "immer";
import { afterEach, vi } from "vitest";
// oxlint-disable-next-line import/no-unassigned-import -- registers jest-dom matchers for Vitest
import "@testing-library/jest-dom/vitest";

// Auto-mock Zustand so `__mocks__/zustand.ts` resets stores after each test.
// See https://zustand.docs.pmnd.rs/learn/guides/testing
vi.mock("zustand");

const memoryStorage = (() => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()].at(index) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } satisfies Storage;
})();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: memoryStorage,
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: memoryStorage,
});

// Ensures GT is initialized and translations are ready before any test module imports.
await import("./translations");

enableMapSet();

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- augmenting globalThis
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

// React 19 + Testing Library: allow act() without the environment warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom reports quirks mode because its document is built without a
// doctype, and KaTeX (via Streamdown) warns about that on every render.
Object.defineProperty(document, "compatMode", {
  configurable: true,
  value: "CSS1Compat",
});

// Deno's `reportException` dispatches ErrorEvents from the Deno web realm.
// happy-dom's `window.dispatchEvent` rejects those as not instances of its
// Event class, which kills the Vitest worker. Swallow that realm mismatch so
// the original async exception can surface (or be ignored) without crashing.
const originalWindowDispatchEvent = window.dispatchEvent.bind(window);

window.dispatchEvent = ((event: Event) => {
  try {
    return originalWindowDispatchEvent(event);
  } catch {
    return false;
  }
}) as typeof window.dispatchEvent;

afterEach(() => {
  cleanup();
  memoryStorage.clear();
});
