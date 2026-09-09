import { describe, expect, it } from "vitest";

import { rebaseText } from "./text-rebase";

describe("rebaseText", () => {
  it("keeps non-overlapping edits from both sides", () => {
    const base = "alpha\nbravo\ncharlie";

    expect(rebaseText(base, "ALPHA\nbravo\ncharlie", "alpha\nbravo\nCHARLIE")).toBe(
      "ALPHA\nbravo\nCHARLIE",
    );
  });

  it("resolves overlapping edits to theirs", () => {
    const base = "alpha\nbravo\ncharlie";

    expect(rebaseText(base, "alpha\nmine\ncharlie", "alpha\ntheirs\ncharlie")).toBe(
      "alpha\ntheirs\ncharlie",
    );
  });

  it("collapses identical edits on both sides", () => {
    const base = "alpha\nbravo";

    expect(rebaseText(base, "alpha\nsame", "alpha\nsame")).toBe("alpha\nsame");
  });
});
