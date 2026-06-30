import { getMentionOnSelectItem } from "@platejs/mention";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useEditorRef } from "platejs/react";
import { useCallback } from "react";

import { hashFileContents } from "@/lib/hash";

import { findArtifactsBySha256 } from "../-thread-api/find-artifacts-by-sha256";
import { threadQuery } from "../-thread-api/get-thread";
import { getThreadEditorId } from "../-thread-components/composer/plate";
import { getMentionKey } from "../-thread-components/composer/plate-plugins/mention-key";
import type { ThreadInputLocation } from "../../-chat-store";
import { useAddAttachment, useIsAddingAttachment } from "./use-add-attachment";
import {
  useIsUploadingArtifact,
  useUploadArtifact,
} from "./use-upload-artifact";

const insertMentionItem = getMentionOnSelectItem();

export const useComposerUpload = (
  threadId: string,
  location: ThreadInputLocation
) => {
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const { data: topicId } = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  });

  const isUploading = useIsUploadingArtifact(threadId);
  const isAttaching = useIsAddingAttachment(threadId);
  const { mutate: uploadArtifact } = useUploadArtifact(threadId);
  const { mutate: addAttachment } = useAddAttachment(threadId, location);
  const { mutateAsync: findDuplicateArtifacts, isPending } = useMutation({
    mutationFn: async (sha256s: string[]) => {
      if (!topicId) {
        return [];
      }

      return findArtifactsBySha256({
        data: { sha256s, topicId },
      });
    },
  });

  const canUpload =
    !editor.meta.isFallback &&
    (topicId ? !isUploading && !isPending : !isAttaching);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!canUpload || files.length === 0) {
        return;
      }

      const fileEntries = await Promise.all(
        files.map(async (file) => ({
          file,
          sha256: await hashFileContents(file),
        }))
      );

      if (topicId) {
        const existingArtifacts = await findDuplicateArtifacts(
          fileEntries.map((entry) => entry.sha256)
        );

        for (const { file, sha256 } of fileEntries) {
          const existingArtifact = existingArtifacts.find(
            (artifact) => artifact.sha256 === sha256
          );
          const artifactId = existingArtifact?.id ?? nanoid();

          if (!existingArtifact || existingArtifact.status === "failed") {
            uploadArtifact({ topicId, artifactId, file, sha256 });
          }

          insertMentionItem(editor, {
            key: getMentionKey({ type: "artifact", value: artifactId }),
            text: file.name,
          });
        }
      } else {
        for (const { file, sha256 } of fileEntries) {
          addAttachment({ file, sha256 });

          insertMentionItem(editor, {
            key: getMentionKey({ type: "attachment", value: sha256 }),
            text: file.name,
          });
        }
      }

      editor.tf.focus({ edge: "endEditor" });
    },
    [
      addAttachment,
      canUpload,
      editor,
      findDuplicateArtifacts,
      topicId,
      uploadArtifact,
    ]
  );

  return { canUpload, uploadFiles };
};
