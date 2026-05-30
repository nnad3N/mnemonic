import { getRouteApi } from "@tanstack/react-router";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import type { ThreadInputLocation } from "../../-thread-store";
import { ComposerFooter } from "./composer-footer";
import { getThreadEditorId, threadEditorPlugins } from "./plate";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins";

type ThreadComposerProps = {
  location: ThreadInputLocation;
};

const Route = getRouteApi("/_protected/chat/$threadId");

export const ThreadComposer = ({ location }: ThreadComposerProps) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const editorId = getThreadEditorId(threadId, location);

  const editor = usePlateEditor({
    id: editorId,
    plugins: threadEditorPlugins,
    autoSelect: "end",
  });

  const { cancelEditing, sendMessage, stopStream } =
    useComposerActions(location);

  useEffect(() => {
    if (editor.meta.isFallback) {
      return;
    }

    editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", sendMessage);
    editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", cancelEditing);
    editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", stopStream);

    // oxlint-disable-next-line typescript/consistent-return
    return () => {
      editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", undefined);
      editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", undefined);
      editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", undefined);
    };
  }, [cancelEditing, editor, sendMessage, stopStream]);

  return (
    <div
      className={cn(
        "w-full max-w-lg min-w-0 rounded-2xl border bg-input/50 p-2 text-base md:text-sm"
      )}
    >
      <Plate editor={editor}>
        <PlateContent className="p-1 outline-none" />
      </Plate>
      <ComposerFooter location={location} />
    </div>
  );
};
