import { describe, expect, it } from "vitest";

import { expectOk } from "@/test/result";

import { toFileText } from "./get-file.server";

const CSV = 'a,b\n"1","","x, y"\n';

const csvFile = () => {
  const bytes = new TextEncoder().encode(CSV);

  return {
    bytes,
    displayName: "rows.csv",
    fileId: "file-id",
    mimeType: "text/csv",
    sizeBytes: bytes.length,
  };
};

describe("toFileText", () => {
  it("hands back the bytes of an already-text file rather than extracting them", async () => {
    expect(expectOk(await toFileText(csvFile()))).toBe(CSV);
  });

  it("extracts an already-text file when asked to", async () => {
    expect(expectOk(await toFileText(csvFile(), true))).not.toBe(CSV);
  });
});
