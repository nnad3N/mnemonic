import { describe, expect, it } from "vitest";

import { expectErr, expectOk } from "@/test/result";

import { UPLOAD_MAX_BYTES, validateUploadFile } from "./file-validation";

describe("validateUploadFile", () => {
  it("accepts a supported mime type under the size limit", () => {
    expectOk(validateUploadFile({ mimeType: "application/pdf", sizeBytes: 1024 }));
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
