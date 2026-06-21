import { MentionPlugin } from "@platejs/mention/react";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { useEditorRef } from "platejs/react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { FILE_INPUT_ACCEPT } from "@/lib/supported-mime-types";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { uploadFileMutation } from "../../-thread-api/upload-file";
import { useThreadChat } from "../../-thread-chat-context";
import type { ThreadInputLocation } from "../../-thread-store";
import { getThreadEditorId } from "./plate";
import { getMentionKey } from "./plate-plugins";

type ComposerFooterProps = {
  location: ThreadInputLocation;
};

export const ComposerFooter = ({ location }: ComposerFooterProps) => {
  const chat = useThreadChat();

  return (
    <div className="flex w-full items-center justify-between">
      <UploadButton location={location} />
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
        <SendButton location={location} />
      )}
    </div>
  );
};

const UploadButton = ({ location }: ComposerFooterProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const uploadFileOptions = uploadFileMutation(threadId);
  const isUploading =
    useIsMutating({
      mutationKey: uploadFileOptions.mutationKey,
    }) > 0;
  const { mutate } = useMutation(uploadFileMutation(threadId));

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
        onChange={(e) => {
          const files = e.target.files;

          if (!files) {
            return;
          }

          for (const file of files) {
            const fileId = nanoid();
            mutate({ fileId, file });
            editor.getTransforms(MentionPlugin).insert.mention({
              key: getMentionKey({ type: "artifact", value: fileId }),
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
