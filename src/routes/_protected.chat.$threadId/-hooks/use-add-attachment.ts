import { useIsMutating, useMutation } from "@tanstack/react-query";

import { isLLMNativeImageMimeType } from "@/lib/file-validation";

import {
  extractFileText,
  getExtractFileTextData,
} from "../-thread-api/extract-file-text";
import { threadMutationKeys } from "../-thread-api/query-keys";
import { useChatStore } from "../../-chat-store";

export type AddAttachmentVars = {
  threadId: string;
  attachmentId: string;
  file: File;
  sha256: string;
};

export const useAddAttachment = (threadId: string) => {
  const setComposerAttachment = useChatStore(
    (state) => state.setComposerAttachment
  );

  return useMutation({
    mutationKey: threadMutationKeys.addAttachment(threadId),
    mutationFn: async ({ attachmentId, file, sha256 }: AddAttachmentVars) => {
      let fileToAttach = file;

      if (!isLLMNativeImageMimeType(file.type)) {
        const { text } = await extractFileText({
          data: getExtractFileTextData({ file }),
        });
        fileToAttach = new File([text], file.name, { type: "text/plain" });
      }

      setComposerAttachment(threadId, {
        id: attachmentId,
        sha256,
        status: "ready",
        file: fileToAttach,
      });

      return { attachmentId };
    },
    onMutate: ({ attachmentId, file, sha256 }) => {
      setComposerAttachment(threadId, {
        id: attachmentId,
        sha256,
        status: "pending",
        file,
      });
    },
    onError: (_error, { attachmentId, file, sha256 }) => {
      setComposerAttachment(threadId, {
        id: attachmentId,
        sha256,
        status: "failed",
        file,
      });
    },
  });
};

export const useIsAddingAttachment = (threadId: string) =>
  useIsMutating({
    mutationKey: threadMutationKeys.addAttachment(threadId),
  }) > 0;
