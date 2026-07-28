import { beforeAll } from "vitest";
// oxlint-disable-next-line import/no-unassigned-import -- registers vitest-browser-react page.render types
import "vitest-browser-react";

// oxlint-disable-next-line import/no-unassigned-import -- real app CSS for layout assertions
import "@/styles.css";

// oxlint-disable-next-line import/no-unassigned-import -- shared mocks / GT / immer
import "./setup-common";

beforeAll(() => {
  // Mirrors `__root.tsx` `<body className="overflow-hidden">`.
  document.body.classList.add("overflow-hidden");
  // So root `parseLocale()` finds a candidate and skips its client warn.
  document.cookie = "generaltranslation.locale=en; path=/";
});
