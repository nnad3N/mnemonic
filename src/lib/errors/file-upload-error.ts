import { TaggedError } from "better-result";

type FileUploadErrorReason =
  | "s3-error"
  | "file-too-large"
  | "unsupported-mime-type";

export type FileUploadErrorShape = {
  message?: string;
  reason: FileUploadErrorReason;
};

const fileUploadErrorMessage = (args: FileUploadErrorShape) => {
  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (args.reason) {
    case "unsupported-mime-type": {
      return "Unsupported file type";
    }
    case "file-too-large": {
      return "File exceeds the maximum upload size";
    }
    default: {
      return "File upload failed";
    }
  }
};

export class FileUploadError extends TaggedError(
  "FileUploadError"
)<FileUploadErrorShape>() {
  constructor(args: FileUploadErrorShape) {
    super({
      ...args,
      message: args.message ?? fileUploadErrorMessage(args),
    });
  }
}
