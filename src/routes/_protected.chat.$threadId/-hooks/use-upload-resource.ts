import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Result } from "better-result";

import type { ResourceUploadErrorShape } from "@/lib/errors/resource-upload-error";
import { ResourceUploadError } from "@/lib/errors/resource-upload-error";

import { mentionByIdQuery } from "../-thread-api/get-mentions";
import { threadKeys, threadMutationKeys } from "../-thread-api/query-keys";
import {
  getPresignedUrl,
  processResource,
  updateResourceStatus,
} from "../-thread-api/upload-resource";
import type { GetPresignedUrlOk } from "../-thread-api/upload-resource";

export type UploadResourceVars = {
  topicId: string;
  file: File;
  resourceId: string;
  sha256: string;
};

export const useUploadResource = (threadId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 3,
    mutationKey: threadMutationKeys.uploadResource(threadId),
    mutationFn: async ({ file, resourceId, sha256 }: UploadResourceVars) => {
      const serialized = await getPresignedUrl({
        data: {
          displayName: file.name,
          resourceId,
          mimeType: file.type,
          sha256,
          sizeBytes: file.size,
          threadId,
        },
      });

      const result = Result.deserialize<
        GetPresignedUrlOk,
        ResourceUploadErrorShape
      >(serialized);

      if (Result.isError(result)) {
        throw result.error;
      }

      if (result.value.type === "skipped") {
        return { resourceId };
      }

      const presignedUrl = result.value.presignedUrl;

      const uploadResult = await Result.tryPromise(async () =>
        fetch(presignedUrl, {
          body: file,
          headers: {
            "Content-Type": file.type,
          },
          method: "PUT",
        })
      );

      if (Result.isError(uploadResult)) {
        throw new ResourceUploadError({
          reason: "s3-error",
          message: uploadResult.error.message,
        });
      }

      if (!uploadResult.value.ok) {
        throw new ResourceUploadError({
          reason: "s3-error",
          message: `Upload failed with status ${uploadResult.value.status}`,
        });
      }

      await processResource({
        data: {
          resourceId,
        },
      });

      return { resourceId };
    },
    onMutate: async ({ resourceId, file }) => {
      const mentionQuery = mentionByIdQuery({
        type: "resource",
        id: resourceId,
      });

      await queryClient.cancelQueries({ queryKey: mentionQuery.queryKey });

      queryClient.setQueryData(mentionQuery.queryKey, () => ({
        id: resourceId,
        displayName: file.name,
        status: "uploading" as const,
      }));
    },
    onError: async (error, { resourceId }) => {
      const mentionQuery = mentionByIdQuery({
        type: "resource",
        id: resourceId,
      });

      queryClient.setQueryData(mentionQuery.queryKey, (current) =>
        current ? { ...current, status: "failed" as const } : current
      );

      if (ResourceUploadError.is(error) && error.reason === "s3-error") {
        await Result.tryPromise(
          async () =>
            updateResourceStatus({
              data: {
                resourceId,
                status: "failed",
              },
            }),
          {
            retry: {
              times: 3,
              delayMs: 1000,
              backoff: "exponential",
            },
          }
        );
      }
    },
    onSettled: async (_data, _error, { topicId, resourceId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: threadKeys.mention("resource", resourceId),
        }),
        queryClient.invalidateQueries({
          queryKey: threadKeys.mentions(topicId),
        }),
      ]);
    },
  });
};

export const useIsUploadingResource = (threadId: string) =>
  useIsMutating({
    mutationKey: threadMutationKeys.uploadResource(threadId),
  }) > 0;
