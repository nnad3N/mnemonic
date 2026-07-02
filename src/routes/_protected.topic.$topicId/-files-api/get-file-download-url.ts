import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Result } from "better-result";

import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { getPresignedGetUrl } from "@/lib/s3";

const FILE_DOWNLOAD_URL_TTL_SECONDS = 3600;

export const getFileDownloadUrl = createServerFn({ method: "GET" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    if (context.file.status !== "ready") {
      throw notFound();
    }

    const urlResult = await getPresignedGetUrl({
      expiresIn: FILE_DOWNLOAD_URL_TTL_SECONDS,
      key: context.file.s3Key,
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(context.file.displayName)}`,
    });

    if (Result.isError(urlResult)) {
      throw urlResult.error;
    }

    return { url: urlResult.value };
  });
