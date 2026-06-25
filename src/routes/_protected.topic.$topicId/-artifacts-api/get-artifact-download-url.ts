import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";
import * as v from "valibot";

import { db } from "@/db";
import { topicAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedGetUrl } from "@/lib/s3";

const ARTIFACT_DOWNLOAD_URL_TTL_SECONDS = 3600;

const getArtifactDownloadUrlInputSchema = v.object({
  artifactId: v.pipe(v.string(), v.nanoid()),
  topicId: v.pipe(v.string(), v.nanoid()),
});

export const getArtifactDownloadUrl = createServerFn({ method: "GET" })
  .inputValidator(getArtifactDownloadUrlInputSchema)
  .middleware([topicAccessMiddleware])
  .handler(async ({ data }) => {
    const artifactRow = await db.query.artifact.findFirst({
      columns: { displayName: true, s3Key: true, status: true },
      where: {
        id: data.artifactId,
        topicId: data.topicId,
      },
    });

    if (!artifactRow || artifactRow.status !== "ready") {
      throw notFound();
    }

    const urlResult = await getPresignedGetUrl({
      expiresIn: ARTIFACT_DOWNLOAD_URL_TTL_SECONDS,
      key: artifactRow.s3Key,
      responseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(artifactRow.displayName)}`,
    });

    if (Result.isError(urlResult)) {
      throw urlResult.error;
    }

    return { url: urlResult.value };
  });
