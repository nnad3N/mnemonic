import { TaggedError } from "better-result";

type ResourceUploadErrorReason =
  | "s3-error"
  | "file-too-large"
  | "unsupported-mime-type";

export type ResourceUploadErrorShape = {
  message?: string;
  reason: ResourceUploadErrorReason;
};

const ResourceUploadErrorMessage = (args: ResourceUploadErrorShape) => {
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

export class ResourceUploadError extends TaggedError(
  "ResourceUploadError"
)<ResourceUploadErrorShape>() {
  constructor(args: ResourceUploadErrorShape) {
    super({
      ...args,
      message: args.message ?? ResourceUploadErrorMessage(args),
    });
  }
}
