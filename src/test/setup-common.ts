import { enableMapSet } from "immer";
import { afterEach, vi } from "vitest";

import { testAuthSession } from "./fixtures/session";

// Auto-mock Zustand so `__mocks__/zustand.ts` resets stores after each test.
// See https://zustand.docs.pmnd.rs/learn/guides/testing
vi.mock("zustand");

vi.mock("@/lib/better-auth/auth-client", () => ({
  authClient: {
    getSession: vi.fn<() => Promise<{ data: typeof testAuthSession; error: null }>>(async () =>
      Promise.resolve({ data: testAuthSession, error: null }),
    ),
    useSession: () => ({
      data: testAuthSession,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: vi.fn<() => void>(),
    }),
  },
}));

// Ensures GT is initialized and translations are ready before any test module imports.
await import("./translations");

enableMapSet();

afterEach(() => {
  localStorage.clear();
});
