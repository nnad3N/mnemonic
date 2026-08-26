import { TaggedError } from "better-result";

type FileUploadErrorReason = "s3-error" | "file-too-large" | "unsupported-mime-type";

export type FileUploadErrorFields = {
  message?: string;
  reason: FileUploadErrorReason;
};

const FileUploadErrorMessage = (args: FileUploadErrorFields) => {
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

export class FileUploadError extends TaggedError("FileUploadError")<FileUploadErrorFields> {
  constructor(args: FileUploadErrorFields) {
    super({
      ...args,
      message: args.message ?? FileUploadErrorMessage(args),
    });
  }
}
