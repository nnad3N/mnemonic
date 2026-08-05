import { Result } from "better-result";
import { describe, expect, it } from "vitest";

import { expectErr } from "@/test/result";

import { isImageMimeType, UPLOAD_MAX_BYTES, validateUploadFile } from "./file-validation";

describe("isImageMimeType", () => {
  it("accepts image/png and rejects other mime types", () => {
    expect(isImageMimeType("image/png")).toBe(true);
    expect(isImageMimeType("application/pdf")).toBe(false);
  });
});

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
});
