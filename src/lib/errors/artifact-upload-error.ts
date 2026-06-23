import { TaggedError } from "better-result";

type ArtifactUploadErrorReason =
  | "s3-error"
  | "file-too-large"
  | "unsupported-mime-type";

export type ArtifactUploadErrorShape = {
  message?: string;
  reason: ArtifactUploadErrorReason;
};

const ArtifactUploadErrorMessage = (args: ArtifactUploadErrorShape) => {
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

export class ArtifactUploadError extends TaggedError(
  "ArtifactUploadError"
)<ArtifactUploadErrorShape>() {
  constructor(args: ArtifactUploadErrorShape) {
    super({
      ...args,
      message: args.message ?? ArtifactUploadErrorMessage(args),
    });
  }
}
