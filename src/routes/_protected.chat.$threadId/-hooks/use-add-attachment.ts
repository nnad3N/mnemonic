import { useIsMutating, useMutation } from "@tanstack/react-query";

import { threadMutationKeys } from "../-thread-api/query-keys";
import type { ThreadInputLocation } from "../../-chat-store";
import { useChatStore } from "../../-chat-store";

type AddAttachmentVars = {
  file: File;
  sha256: string;
};

export const useAddAttachment = (threadId: string, location: ThreadInputLocation) => {
  const upsertAttachment = useChatStore((state) => state.upsertAttachment);

  return useMutation({
    mutationKey: threadMutationKeys.addAttachment(threadId),
    mutationFn: async ({ file, sha256 }: AddAttachmentVars) => {
      upsertAttachment(threadId, {
        status: "ready",
        location,
        filename: file.name,
        sha256,
        file,
      });
      return Promise.resolve();
    },
    onMutate: ({ file, sha256 }) => {
      upsertAttachment(threadId, {
        status: "pending",
        location,
        filename: file.name,
        sha256,
        file,
      });
    },
    onError: (_error, { file, sha256 }) => {
      upsertAttachment(threadId, {
        status: "failed",
        location,
        filename: file.name,
        sha256,
        file,
      });
    },
  });
};

export const useIsAddingAttachment = (threadId: string) =>
  useIsMutating({
    mutationKey: threadMutationKeys.addAttachment(threadId),
  }) > 0;
