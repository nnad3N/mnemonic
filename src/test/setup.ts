import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
// oxlint-disable-next-line import/no-unassigned-import -- registers jest-dom matchers for Vitest
import "@testing-library/jest-dom/vitest";

// oxlint-disable-next-line import/no-unassigned-import -- shared mocks / GT / immer
import "./setup-common";

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
  localStorage.clear();
});
