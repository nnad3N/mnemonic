import { mutationOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { nanoid } from "nanoid";

import { threadAccessMiddleware } from "@/lib/middleware/assert-thread-access";

import { threadMutationKeys } from "./query-keys";

const uploadFile = createServerFn({ method: "POST" })
  .middleware([threadAccessMiddleware])
  .handler(async () => {
    await Bun.sleep(5000);
    return { id: nanoid() };
  });

export type UploadFileVars = {
  fileId: string;
  file: File;
};

export const uploadFileMutation = (threadId: string) =>
  mutationOptions({
    mutationKey: threadMutationKeys.uploadFile(threadId),
    mutationFn: async (_vars: UploadFileVars) => {
      await uploadFile({
        data: {
          threadId,
        },
      });
    },
  });
