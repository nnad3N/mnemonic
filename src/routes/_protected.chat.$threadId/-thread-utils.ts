import type { ArtifactStatus } from "@/db/schema";

export const isMentionPending = (mention: { status: ArtifactStatus }) =>
  mention.status === "uploading" || mention.status === "processing";
