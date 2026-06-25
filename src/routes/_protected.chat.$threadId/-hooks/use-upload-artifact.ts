import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Result } from "better-result";

import type { ArtifactUploadErrorShape } from "@/lib/errors/artifact-upload-error";
import { ArtifactUploadError } from "@/lib/errors/artifact-upload-error";

import { mentionByIdQuery } from "../-thread-api/get-mentions";
import { threadKeys, threadMutationKeys } from "../-thread-api/query-keys";
import {
  getPresignedUrl,
  processArtifact,
  updateArtifactStatus,
} from "../-thread-api/upload-artifact";
import type { GetPresignedUrlOk } from "../-thread-api/upload-artifact";

export type UploadArtifactVars = {
  topicId: string;
  file: File;
  artifactId: string;
  sha256: string;
};

export const useUploadArtifact = (threadId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 3,
    mutationKey: threadMutationKeys.uploadArtifact(threadId),
    mutationFn: async ({ file, artifactId, sha256 }: UploadArtifactVars) => {
      const serialized = await getPresignedUrl({
        data: {
          displayName: file.name,
          artifactId,
          mimeType: file.type,
          sha256,
          sizeBytes: file.size,
          threadId,
        },
      });

      const result = Result.deserialize<
        GetPresignedUrlOk,
        ArtifactUploadErrorShape
      >(serialized);

      if (Result.isError(result)) {
        throw result.error;
      }

      if (result.value.type === "skipped") {
        return { artifactId };
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
        throw new ArtifactUploadError({
          reason: "s3-error",
          message: uploadResult.error.message,
        });
      }

      if (!uploadResult.value.ok) {
        throw new ArtifactUploadError({
          reason: "s3-error",
          message: `Upload failed with status ${uploadResult.value.status}`,
        });
      }

      await processArtifact({
        data: {
          artifactId,
          threadId,
        },
      });

      return { artifactId };
    },
    onMutate: async ({ topicId, artifactId, file }) => {
      const mentionQuery = mentionByIdQuery({ topicId, artifactId });

      await queryClient.cancelQueries({ queryKey: mentionQuery.queryKey });

      queryClient.setQueryData(mentionQuery.queryKey, () => ({
        id: artifactId,
        displayName: file.name,
        status: "uploading" as const,
      }));
    },
    onError: async (error, { topicId, artifactId }) => {
      const mentionQuery = mentionByIdQuery({ topicId, artifactId });

      queryClient.setQueryData(mentionQuery.queryKey, (current) =>
        current ? { ...current, status: "failed" as const } : current
      );

      if (ArtifactUploadError.is(error) && error.reason === "s3-error") {
        await Result.tryPromise(
          async () =>
            updateArtifactStatus({
              data: {
                artifactId,
                threadId,
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
    onSettled: async (_data, _error, { topicId, artifactId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: threadKeys.mention({ topicId, artifactId }),
        }),
        queryClient.invalidateQueries({
          queryKey: threadKeys.mentions(topicId),
        }),
      ]);
    },
  });
};

export const useIsUploadingArtifact = (threadId: string) =>
  useIsMutating({
    mutationKey: threadMutationKeys.uploadArtifact(threadId),
  }) > 0;
