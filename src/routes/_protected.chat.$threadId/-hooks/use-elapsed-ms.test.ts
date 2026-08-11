import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useElapsedMs } from "./use-elapsed-ms";

describe("useElapsedMs", () => {
  it("returns undefined when disabled", () => {
    const { result } = renderHook(() => useElapsedMs({ enabled: false }));

    expect(result.current).toBeUndefined();
  });

  it("returns elapsed ms from startedAt", () => {
    const startedAt = Temporal.Now.instant().subtract({ seconds: 80 }).toString();

    const { result } = renderHook(() => useElapsedMs({ enabled: true, startedAt }));

    expect(result.current).toBeGreaterThanOrEqual(79_000);
    expect(result.current).toBeLessThan(81_000);
  });

  it("clamps future startedAt to 0", () => {
    const startedAt = Temporal.Now.instant().add({ seconds: 60 }).toString();

    const { result } = renderHook(() => useElapsedMs({ enabled: true, startedAt }));

    expect(result.current).toBe(0);
  });
});
