import { ClientOnly, useParams } from "@tanstack/react-router";
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { Suspense, useRef } from "react";

import { Button } from "@/components/ui/button";
import { SupportedMimeType } from "@/lib/file-validation";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { useComposerUpload } from "../../-hooks/use-composer-upload";
import { useThreadChat } from "../../-hooks/use-thread-chat";
import type { ThreadInputLocation } from "../../../-chat-store";
import { CapabilityPicker } from "./capability-picker";

type ComposerFooterProps = {
  location: ThreadInputLocation;
};

export const ComposerFooter = ({ location }: ComposerFooterProps) => {
  const fallback = (
    <>
      <UploadButton onSelectFiles={undefined} />
      <SendButton onSend={undefined} />
    </>
  );

  return (
    <div className="flex w-full items-center justify-between">
      <CapabilityPicker />
      <div className="ml-auto flex items-center gap-1">
        <ClientOnly fallback={fallback}>
          <Suspense fallback={fallback}>
            <ComposerActions location={location} />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
};

const ComposerActions = ({ location }: ComposerFooterProps) => {
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const chat = useThreadChat();
  const { canSend, sendMessage, stopStream } = useComposerActions(location);
  const { canUpload, uploadFiles } = useComposerUpload(threadId, location);

  return (
    <>
      <UploadButton onSelectFiles={canUpload ? uploadFiles : undefined} />
      {chat.status === "streaming" || chat.status === "submitted" ? (
        <Button onClick={stopStream} size="icon-xs" type="button">
          <SquareIcon />
        </Button>
      ) : (
        <SendButton onSend={canSend ? sendMessage : undefined} />
      )}
    </>
  );
};

type UploadButtonProps = {
  onSelectFiles: ((files: File[]) => Promise<void>) | undefined;
};

const UPLOAD_ACCEPT = SupportedMimeType.values.join(",");

const UploadButton = ({ onSelectFiles }: UploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Button
      variant="ghost"
      disabled={typeof onSelectFiles === "undefined"}
      onClick={() => inputRef.current?.click()}
      size="icon-sm"
      type="button"
    >
      <input
        accept={UPLOAD_ACCEPT}
        onChange={async (e) => {
          const files = e.target.files;

          if (!files || files.length === 0) return;

          await onSelectFiles?.([...files]);

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

type SendButtonProps = {
  onSend: (() => Promise<void>) | undefined;
};

const SendButton = ({ onSend }: SendButtonProps) => {
  return (
    <Button
      disabled={typeof onSend === "undefined"}
      onClick={async () => {
        await onSend?.();
      }}
      size="icon-sm"
      type="button"
    >
      <ArrowUpIcon />
    </Button>
  );
};
