import { getMentionOnSelectItem } from "@platejs/mention";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useEditorRef } from "platejs/react";
import { useCallback } from "react";

import { hashFileContents } from "@/lib/hash";

import { findFilesBySha256 } from "../-thread-api/find-files-by-sha256";
import { threadQuery } from "../-thread-api/get-thread";
import { getThreadEditorId } from "../-thread-components/composer/plate";
import { getMentionKey } from "../-thread-components/composer/plate-plugins/mention-key";
import type { ThreadInputLocation } from "../../-chat-store";
import { useAddAttachment, useIsAddingAttachment } from "./use-add-attachment";
import { useIsUploadingFile, useUploadFile } from "./use-upload-file";

const insertMentionItem = getMentionOnSelectItem();

export const useComposerUpload = (threadId: string, location: ThreadInputLocation) => {
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const { data: topicId } = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  });

  const isUploading = useIsUploadingFile(threadId);
  const isAttaching = useIsAddingAttachment(threadId);
  const { mutate: uploadFile } = useUploadFile(threadId);
  const { mutate: addAttachment } = useAddAttachment(threadId, location);
  const { mutateAsync: findDuplicateFiles, isPending } = useMutation({
    mutationFn: async (sha256s: string[]) => {
      if (!topicId) {
        return [];
      }

      return findFilesBySha256({
        data: { sha256s, topicId },
      });
    },
  });

  const canUpload =
    !editor.meta.isFallback && (topicId ? !isUploading && !isPending : !isAttaching);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!canUpload || files.length === 0) return;

      const fileEntries = await Promise.all(
        files.map(async (file) => ({
          file,
          sha256: await hashFileContents(file),
        })),
      );

      if (topicId) {
        const existingFiles = await findDuplicateFiles(fileEntries.map((entry) => entry.sha256));

        for (const { file, sha256 } of fileEntries) {
          const existingFile = existingFiles.find((fileItem) => fileItem.sha256 === sha256);
          const fileId = existingFile?.id ?? nanoid();

          if (!existingFile || existingFile.status === "failed") {
            uploadFile({ topicId, fileId, file, sha256 });
          }

          insertMentionItem(editor, {
            key: getMentionKey({ type: "file", value: fileId }),
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
    [addAttachment, canUpload, editor, findDuplicateFiles, topicId, uploadFile],
  );

  return { canUpload, uploadFiles };
};
