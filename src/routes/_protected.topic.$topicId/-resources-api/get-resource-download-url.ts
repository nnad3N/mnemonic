import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";

import { resourceAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedGetUrl } from "@/lib/s3";

const RESOURCE_DOWNLOAD_URL_TTL_SECONDS = 3600;

export const getResourceDownloadUrl = createServerFn({ method: "GET" })
  .middleware([resourceAccessMiddleware])
  .handler(async ({ context }) => {
    if (context.resource.status !== "ready") {
      throw notFound();
    }

    const urlResult = await getPresignedGetUrl({
      expiresIn: RESOURCE_DOWNLOAD_URL_TTL_SECONDS,
      key: context.resource.s3Key,
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(context.resource.displayName)}`,
    });

    if (Result.isError(urlResult)) {
      throw urlResult.error;
    }

    return { url: urlResult.value };
  });
