import { describe, expect, it } from "vitest";

import { withUniqueClipboardImageName } from "./file";

describe("withUniqueClipboardImageName", () => {
  it("inserts a short id before the extension", () => {
    const next = withUniqueClipboardImageName(
      new File([new Uint8Array([1])], "image.png", { type: "image/png" }),
    );

    expect(next.name).toMatch(/^image-[A-Za-z0-9_-]{4}\.png$/);
    expect(next.type).toBe("image/png");
  });

  it("appends an id when the name has no extension", () => {
    const next = withUniqueClipboardImageName(new File([new Uint8Array([1])], "clipboard"));

    expect(next.name).toMatch(/^clipboard-[A-Za-z0-9_-]{4}$/);
  });

  it("keeps every dot but the last so multi-dot names stay intact", () => {
    const next = withUniqueClipboardImageName(new File([new Uint8Array([1])], "a.b.png"));

    expect(next.name).toMatch(/^a\.b-[A-Za-z0-9_-]{4}\.png$/);
  });

  it("gives two pastes of the same clipboard image different names", () => {
    const source = () => new File([new Uint8Array([1])], "image.png", { type: "image/png" });

    expect(withUniqueClipboardImageName(source()).name).not.toBe(
      withUniqueClipboardImageName(source()).name,
    );
  });

  it("carries the original bytes and lastModified into the renamed file", async () => {
    const bytes = new TextEncoder().encode("clipboard-bytes");
    const original = new File([bytes], "image.png", {
      type: "image/png",
      lastModified: 1_700_000_000_000,
    });

    const next = withUniqueClipboardImageName(original);

    expect(next.size).toBe(original.size);
    expect(next.lastModified).toBe(original.lastModified);
    expect(await next.text()).toBe("clipboard-bytes");
  });
});
