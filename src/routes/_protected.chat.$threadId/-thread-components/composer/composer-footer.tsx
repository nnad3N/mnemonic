import { getMentionOnSelectItem } from "@platejs/mention";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { nanoid } from "nanoid";
import type { PlateEditor } from "platejs/react";
import { useEditorRef } from "platejs/react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { SUPPORTED_MIME_TYPES } from "@/lib/file-validation";
import { hashFileContents } from "@/lib/hash";

import {
  useAddAttachment,
  useIsAddingAttachment,
} from "../../-hooks/use-add-attachment";
import { useComposerActions } from "../../-hooks/use-composer-actions";
import {
  useIsUploadingArtifact,
  useUploadArtifact,
} from "../../-hooks/use-upload-artifact";
import { findArtifactsBySha256 } from "../../-thread-api/find-artifacts-by-sha256";
import { threadQuery } from "../../-thread-api/get-thread";
import { useThreadChat } from "../../-thread-chat-provider";
import type { ThreadInputLocation } from "../../../-chat-store";
import { getThreadEditorId } from "./plate";
import { getMentionKey } from "./plate-plugins";

const insertMentionItem = getMentionOnSelectItem();

type ComposerFooterProps = {
  threadId: string;
  location: ThreadInputLocation;
};

export const ComposerFooter = ({ threadId, location }: ComposerFooterProps) => {
  const chat = useThreadChat();
  const topicId = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  }).data;

  return (
    <div className="flex w-full items-center justify-between">
      {topicId ? (
        <TopicUploadButton
          location={location}
          topicId={topicId}
          threadId={threadId}
        />
      ) : (
        <UploadButton location={location} threadId={threadId} />
      )}
      <div className="ml-auto">
        {chat.status === "streaming" ? (
          <Button
            onClick={async () => {
              await chat.stop();
            }}
            size="icon-xs"
            type="button"
          >
            <SquareIcon />
          </Button>
        ) : (
          <SendButton location={location} threadId={threadId} />
        )}
      </div>
    </div>
  );
};

type TopicUploadButtonProps = {
  location: ThreadInputLocation;
  topicId: string;
  threadId: string;
};

const TopicUploadButton = ({
  location,
  threadId,
  topicId,
}: TopicUploadButtonProps) => {
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const isUploading = useIsUploadingArtifact(threadId);
  const { mutate: uploadArtifact } = useUploadArtifact(threadId);
  const { mutateAsync: findDuplicateArtifacts, isPending } = useMutation({
    mutationFn: async (sha256s: string[]) =>
      findArtifactsBySha256({
        data: { sha256s, topicId },
      }),
  });

  return (
    <UploadButtonPrimitive
      editor={editor}
      disabled={isUploading || isPending}
      onUpload={async (fileEntries) => {
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
      }}
    />
  );
};

type UploadButtonProps = {
  location: ThreadInputLocation;
  threadId: string;
};

const UploadButton = ({ location, threadId }: UploadButtonProps) => {
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const isAttaching = useIsAddingAttachment(threadId);
  const { mutate: addAttachment } = useAddAttachment(threadId, location);

  return (
    <UploadButtonPrimitive
      editor={editor}
      disabled={isAttaching}
      onUpload={async (fileEntries) => {
        for (const { file, sha256 } of fileEntries) {
          addAttachment({ file, sha256 });

          insertMentionItem(editor, {
            key: getMentionKey({ type: "attachment", value: sha256 }),
            text: file.name,
          });
        }
      }}
    />
  );
};

type UploadButtonPrimitiveProps = {
  editor: PlateEditor;
  disabled: boolean;
  onUpload: (
    fileEntries: { file: File; sha256: string }[]
  ) => Promise<void> | void;
};

const UPLOAD_ACCEPT = SUPPORTED_MIME_TYPES.join(",");

const UploadButtonPrimitive = ({
  editor,
  disabled,
  onUpload,
}: UploadButtonPrimitiveProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Button
      variant="ghost"
      disabled={disabled || editor.meta.isFallback}
      onClick={() => inputRef.current?.click()}
      size="icon-sm"
      type="button"
    >
      <input
        accept={UPLOAD_ACCEPT}
        onChange={async (e) => {
          const files = e.target.files;

          if (!files || files.length === 0) {
            return;
          }

          const fileEntries = await Promise.all(
            [...files].map(async (file) => ({
              file,
              sha256: await hashFileContents(file),
            }))
          );

          await onUpload(fileEntries);

          editor.tf.focus({ edge: "endEditor" });

          e.target.value = "";
        }}
        multiple
        type="file"
        ref={inputRef}
        hidden
      />

      <PaperclipIcon />
    </Button>
  );
};

const SendButton = ({ location }: ComposerFooterProps) => {
  const { canSend, sendMessage } = useComposerActions(location);

  return (
    <Button
      disabled={!canSend}
      onClick={async () => {
        await sendMessage();
      }}
      size="icon-sm"
      type="button"
    >
      <ArrowUpIcon />
    </Button>
  );
};
