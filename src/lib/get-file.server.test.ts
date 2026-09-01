import { describe, expect, it } from "vitest";

import { expectOk } from "@/test/result";

import { toFileText } from "./get-file.server";

describe("toFileText", () => {
  it("hands back the bytes of an already-text file rather than extracting them", async () => {
    const csv = 'a,b\n"1","","x, y"\n';
    const bytes = new TextEncoder().encode(csv);

    const text = expectOk(
      await toFileText({
        bytes,
        displayName: "rows.csv",
        fileId: "file-id",
        mimeType: "text/csv",
        sizeBytes: bytes.length,
      }),
    );

    expect(text).toBe(csv);
  });
});
