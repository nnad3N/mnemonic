import { getRouteApi } from "@tanstack/react-router";
import { ArrowUpIcon, SquareIcon } from "lucide-react";
import { useEditorRef, useEditorSelector } from "platejs/react";

import { Button } from "@/components/ui/button";

import type { ThreadInputLocation } from "../../-thread-store";
import { useThreadStore } from "../../-thread-store";
import { useChat } from "../../-use-chat";
import {
  getThreadEditorId,
  markdownToPlateValue,
  plateValueToMarkdown,
} from "./plate";

type ComposerFooterProps = {
  location: ThreadInputLocation;
};

const Route = getRouteApi("/_protected/chat/$threadId");

export const ComposerFooter = ({ location }: ComposerFooterProps) => {
  const chat = useChat();

  return (
    <div className="flex w-full items-center justify-end">
      {chat.status === "streaming" ? (
        <Button
          onClick={async () => {
            await chat.stop();
          }}
          size="icon-sm"
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

const SendButton = ({ location }: ComposerFooterProps) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const editorId = getThreadEditorId(threadId, location);
  const editor = useEditorRef(editorId);
  const isEditorEmpty = useEditorSelector(
    (plateEditor) => {
      if (plateEditor === undefined || plateEditor.meta.isFallback) {
        return true;
      }

      return !plateValueToMarkdown(plateEditor).trim();
    },
    [],
    { id: editorId }
  );
  const chat = useChat();
  const editingState = useThreadStore((state) => state.editingState);
  const clearEditingState = useThreadStore((state) => state.clearEditingState);

  return (
    <Button
      disabled={chat.status === "submitted" || isEditorEmpty}
      onClick={async () => {
        const text = plateValueToMarkdown(editor).trim();

        await chat.sendMessage({
          text,
          messageId: location === "edit" ? editingState?.messageId : undefined,
        });

        if (location === "edit") {
          clearEditingState();
        }
        editor.tf.setValue(markdownToPlateValue(editor, ""));
      }}
      size="icon-sm"
      type="button"
    >
      <ArrowUpIcon />
    </Button>
  );
};
