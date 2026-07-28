import { Result } from "better-result";
import { describe, expect, it } from "vitest";

import { expectErr } from "@/test/result";

import {
  isImageMimeType,
  isLLMNativeImageMimeType,
  isSupportedMimeType,
  UPLOAD_MAX_BYTES,
  validateUploadFile,
} from "./file-validation";
import { hashFileContents } from "./hash";

describe("validateUploadFile", () => {
  it("accepts a supported mime type under the size limit", () => {
    expect(Result.isOk(validateUploadFile({ mimeType: "application/pdf", sizeBytes: 1024 }))).toBe(
      true,
    );
  });

  it("rejects unsupported mime types", () => {
    const error = expectErr(
      validateUploadFile({
        mimeType: "application/x-unknown",
        sizeBytes: 10,
      }),
    );

    expect(error.reason).toBe("unsupported-mime-type");
  });

  it("rejects files over the upload size limit", () => {
    const error = expectErr(
      validateUploadFile({
        mimeType: "text/plain",
        sizeBytes: UPLOAD_MAX_BYTES + 1,
      }),
    );

    expect(error.reason).toBe("file-too-large");
  });

  it("matches mime types by exact string, not as wildcards", () => {
    // "image/*" is kept in SUPPORTED_MIME_TYPES for the browser accept attribute.
    expect(isSupportedMimeType("image/*")).toBe(true);
    expect(isSupportedMimeType("image/png")).toBe(true);
    expect(isSupportedMimeType("image/made-up")).toBe(false);
  });
});

describe("isImageMimeType", () => {
  it("accepts any image subtype by prefix, including unsupported ones", () => {
    // processForRagFn uses this to skip text extraction, so it must stay a
    // prefix check rather than a SUPPORTED_MIME_TYPES lookup.
    expect(isImageMimeType("image/png")).toBe(true);
    expect(isImageMimeType("image/made-up")).toBe(true);
    expect(isImageMimeType("application/pdf")).toBe(false);
    expect(isImageMimeType("text/image")).toBe(false);
  });
});

describe("isLLMNativeImageMimeType", () => {
  it("covers documents the model reads directly, not just images", () => {
    expect(isLLMNativeImageMimeType("application/pdf")).toBe(true);
    expect(isLLMNativeImageMimeType("text/markdown")).toBe(true);
    expect(isLLMNativeImageMimeType("image/png")).toBe(true);
  });

  it("rejects supported uploads the model cannot read directly", () => {
    expect(isSupportedMimeType("image/*")).toBe(true);
    expect(isLLMNativeImageMimeType("image/*")).toBe(false);
  });
});

describe("hashFileContents", () => {
  it("hashes known bytes to the expected sha-256 hex", async () => {
    const file = new File([new TextEncoder().encode("abc")], "abc.txt");
    const digest = await hashFileContents(file);

    expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(digest).toHaveLength(64);
  });
});
