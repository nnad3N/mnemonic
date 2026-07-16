import { createServerFn } from "@tanstack/react-start";

import { Kit, toServerFnError } from "@/lib/kit";
import { fileAccessMiddleware } from "@/lib/middleware/assert-thread-access";
import { s3Kit } from "@/lib/s3";

const FILE_DOWNLOAD_URL_TTL_SECONDS = 3600;

export const getFileDownloadUrl = createServerFn({ method: "GET" })
  .middleware([fileAccessMiddleware])
  .handler(async ({ context }) => {
    if (context.file.status !== "ready") {
      throw toServerFnError.notFound();
    }

    const result = await Kit.get(s3Kit).getPresignedGetUrl({
      expiresIn: FILE_DOWNLOAD_URL_TTL_SECONDS,
      key: context.file.s3Key,
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(context.file.displayName)}`,
    });

    if (result.isErr()) {
      throw toServerFnError.serverError("Failed to get file download URL");
    }

    return { url: result.value };
  });
