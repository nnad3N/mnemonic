import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";

import { artifactAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedGetUrl } from "@/lib/s3";

const ARTIFACT_DOWNLOAD_URL_TTL_SECONDS = 3600;

export const getArtifactDownloadUrl = createServerFn({ method: "GET" })
  .middleware([artifactAccessMiddleware])
  .handler(async ({ context }) => {
    if (context.artifact.status !== "ready") {
      throw notFound();
    }

    const urlResult = await getPresignedGetUrl({
      expiresIn: ARTIFACT_DOWNLOAD_URL_TTL_SECONDS,
      key: context.artifact.s3Key,
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(context.artifact.displayName)}`,
    });

    if (Result.isError(urlResult)) {
      throw urlResult.error;
    }

    return { url: urlResult.value };
  });
