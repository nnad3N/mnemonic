import { MentionPlugin } from "@platejs/mention/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useEditorRef } from "platejs/react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { hashFileContents } from "@/lib/hash";
import { FILE_INPUT_ACCEPT } from "@/lib/supported-files";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import {
  useIsUploadingArtifact,
  useUploadArtifact,
} from "../../-hooks/use-upload-artifact";
import { mentionsQuery } from "../../-thread-api/get-mentions";
import { threadQuery } from "../../-thread-api/get-thread";
import { useThreadChat } from "../../-thread-chat-context";
import type { ThreadInputLocation } from "../../-thread-store";
import { getThreadEditorId } from "./plate";
import { getMentionKey } from "./plate-plugins";

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
      {topicId && (
        <UploadButton
          location={location}
          topicId={topicId}
          threadId={threadId}
        />
      )}
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
  );
};

type UploadButtonProps = {
  location: ThreadInputLocation;
  topicId: string;
  threadId: string;
};

const UploadButton = ({ location, threadId, topicId }: UploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const isUploading = useIsUploadingArtifact(threadId);
  const { mutate } = useUploadArtifact(threadId);
  const { data: mentions } = useSuspenseQuery(mentionsQuery(topicId));

  return (
    <Button
      variant="ghost"
      disabled={isUploading || editor.meta.isFallback}
      onClick={() => inputRef.current?.click()}
      size="icon-sm"
      type="button"
    >
      <input
        accept={FILE_INPUT_ACCEPT}
        onChange={async (e) => {
          const files = e.target.files;

          if (!files) {
            return;
          }

          for (const file of files) {
            const sha256 = await hashFileContents(file);
            const existingArtifact = mentions.find(
              (mention) => mention.sha256 === sha256
            );
            const artifactId = existingArtifact?.id ?? nanoid();

            if (!existingArtifact || existingArtifact.status === "failed") {
              mutate({ topicId, artifactId, file, sha256 });
            }

            editor.getTransforms(MentionPlugin).insert.mention({
              key: getMentionKey({ type: "artifact", value: artifactId }),
              search: "",
              value: file.name,
            });
          }

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
