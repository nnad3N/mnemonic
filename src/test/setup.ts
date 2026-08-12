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

// happy-dom has no Web Animations API. Base UI ScrollArea calls
// `viewport.getAnimations({ subtree: true })` on a 0ms timeout after mount.
if (typeof Element.prototype.getAnimations !== "function") {
  Element.prototype.getAnimations = () => [];
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
