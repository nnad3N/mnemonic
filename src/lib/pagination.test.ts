import { describe, expect, it } from "vitest";

import { getVisiblePageNumbers } from "./pagination";

describe("getVisiblePageNumbers", () => {
  it("returns every page when total fits in the window", () => {
    expect(getVisiblePageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps a seven-page window centered on the current page", () => {
    expect(getVisiblePageNumbers(10, 20)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  });

  it("clamps to the start near page 1", () => {
    expect(getVisiblePageNumbers(1, 20)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("clamps to the end near the last page", () => {
    expect(getVisiblePageNumbers(20, 20)).toEqual([14, 15, 16, 17, 18, 19, 20]);
  });

  it("switches from listing every page to windowing between 7 and 8 total pages", () => {
    expect(getVisiblePageNumbers(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getVisiblePageNumbers(4, 8)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getVisiblePageNumbers(5, 8)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("always returns exactly seven pages once the total exceeds the window", () => {
    for (let current = 1; current <= 30; current++) {
      expect(getVisiblePageNumbers(current, 30)).toHaveLength(7);
    }
  });

  it("returns an empty list when there are no pages", () => {
    expect(getVisiblePageNumbers(1, 0)).toEqual([]);
  });
});
