import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { Result } from "better-result";

import { FileUploadError } from "@/lib/errors/file-upload-error";

import { mentionByIdQuery } from "../-thread-api/get-mentions";
import { threadKeys, threadMutationKeys } from "../-thread-api/query-keys";
import { getPresignedUrl, processFile } from "../-thread-api/upload-file";

export type UploadFileVars = {
  topicId: string;
  file: File;
  fileId: string;
  sha256: string;
};

export const useUploadFile = (threadId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 3,
    mutationKey: threadMutationKeys.uploadFile(threadId),
    mutationFn: async ({ file, fileId, sha256 }: UploadFileVars) => {
      const presigned = await getPresignedUrl({
        data: {
          displayName: file.name,
          fileId,
          mimeType: file.type,
          sha256,
          sizeBytes: file.size,
          threadId,
        },
      });

      if (presigned.type === "skipped") {
        return { fileId };
      }

      const uploadResult = await Result.tryPromise(async () =>
        fetch(presigned.presignedUrl, {
          body: file,
          headers: {
            "Content-Type": file.type,
          },
          method: "PUT",
        }),
      );

      if (Result.isError(uploadResult)) {
        throw new FileUploadError({
          reason: "s3-error",
          message: uploadResult.error.message,
        });
      }

      if (!uploadResult.value.ok) {
        throw new FileUploadError({
          reason: "s3-error",
          message: `Upload failed with status ${uploadResult.value.status}`,
        });
      }

      await processFile({
        data: {
          fileId,
        },
      });

      return { fileId };
    },
    onMutate: async ({ fileId, file }) => {
      const mentionQuery = mentionByIdQuery({
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
    onSettled: async (_data, _error, { topicId, fileId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: threadKeys.mention("file", fileId),
        }),
        queryClient.invalidateQueries({
          queryKey: threadKeys.mentions(topicId),
        }),
      ]);
    },
  });
};

export const useIsUploadingFile = (threadId: string) =>
  useIsMutating({
    mutationKey: threadMutationKeys.uploadFile(threadId),
  }) > 0;
