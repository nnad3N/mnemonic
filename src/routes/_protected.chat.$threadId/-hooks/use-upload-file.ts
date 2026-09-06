import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";

import { fileMutations } from "../-thread-api/files.functions";
import { mentionQueries } from "../-thread-api/mentions.functions";

export type { UploadFileVars } from "../-thread-api/files.functions";

export const useUploadFile = (threadId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...fileMutations.upload(threadId),
    onMutate: async ({ fileId, file }) => {
      const mentionQuery = mentionQueries.detail({
        type: "file",
        id: fileId,
      });

      await queryClient.cancelQueries({ queryKey: mentionQuery.queryKey });

      queryClient.setQueryData(mentionQuery.queryKey, () => ({
        id: fileId,
        displayName: file.name,
        status: "uploading" as const,
      }));
    },
    onSettled: async (_data, _error, { fileId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: mentionQueries.detail({ type: "file", id: fileId }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: mentionQueries.lists(),
        }),
      ]);
    },
  });
};

export const useIsUploadingFile = (threadId: string) =>
  useIsMutating({
    mutationKey: fileMutations.upload(threadId).mutationKey,
  }) > 0;
