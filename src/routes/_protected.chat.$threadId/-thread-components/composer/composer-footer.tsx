import { useParams } from "@tanstack/react-router";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { SUPPORTED_MIME_TYPES } from "@/lib/file-validation";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { useComposerUpload } from "../../-hooks/use-composer-upload";
import { useThreadChat } from "../../-hooks/use-thread-chat";
import type { ThreadInputLocation } from "../../../-chat-store";
import { CapabilityPicker } from "./capability-picker";

type ComposerFooterProps = {
  location: ThreadInputLocation;
};

export const ComposerFooter = ({ location }: ComposerFooterProps) => {
  const chat = useThreadChat();
  const { stopStream } = useComposerActions(location);

  return (
    <div className="flex w-full items-center justify-between">
      <CapabilityPicker />
      <div className="ml-auto flex items-center gap-1">
        <UploadButton location={location} />
        {chat.status === "streaming" || chat.status === "submitted" ? (
          <Button
            onClick={async () => {
              await stopStream();
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
    </div>
  );
};

type UploadButtonProps = {
  location: ThreadInputLocation;
};

const UPLOAD_ACCEPT = SUPPORTED_MIME_TYPES.join(",");

const UploadButton = ({ location }: UploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const { canUpload, uploadFiles } = useComposerUpload(threadId, location);

  return (
    <Button
      variant="ghost"
      disabled={!canUpload}
      onClick={() => inputRef.current?.click()}
      size="icon-sm"
      type="button"
    >
      <input
        accept={UPLOAD_ACCEPT}
        onChange={async (e) => {
          const files = e.target.files;

          if (!files || files.length === 0) return;

          await uploadFiles([...files]);

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

const SendButton = ({ location }: Pick<ComposerFooterProps, "location">) => {
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
