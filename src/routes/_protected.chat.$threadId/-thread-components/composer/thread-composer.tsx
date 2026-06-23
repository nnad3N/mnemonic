import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
  Plate,
  PlateContent,
  useEditorMounted,
  usePlateEditor,
} from "platejs/react";
import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { threadQuery } from "../../-thread-api/get-thread";
import type { ThreadInputLocation } from "../../-thread-store";
import { useThreadStore } from "../../-thread-store";
import { ComposerFooter } from "./composer-footer";
import {
  getThreadEditorPlugins,
  getThreadEditorId,
  markdownToPlate,
} from "./plate";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins";

type ThreadComposerProps = {
  location: ThreadInputLocation;
};

const Route = getRouteApi("/_protected/chat/$threadId");

export const ThreadComposer = ({ location }: ThreadComposerProps) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const topicId = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  }).data;
  const editorId = getThreadEditorId(threadId, location);
  const editingState = useThreadStore((state) => state.editingState);

  const editor = usePlateEditor({
    id: editorId,
    plugins: getThreadEditorPlugins(topicId),
    autoSelect: "end",
  });
  const isEditorMounted = useEditorMounted(editorId);

  const { cancelEditing, sendMessage, stopStream } =
    useComposerActions(location);
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location !== "edit") {
      return;
    }

    const handlePointerDown = (e: PointerEvent) => {
      const node = composerRef.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        cancelEditing();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    // oxlint-disable-next-line typescript/consistent-return
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [cancelEditing, location]);

  useEffect(() => {
    if (editor.meta.isFallback || !isEditorMounted) {
      return;
    }

    if (location === "edit" && editingState?.markdown) {
      editor.tf.setValue(markdownToPlate(editor, editingState.markdown));
    }

    editor.tf.focus({ edge: "endEditor" });
  }, [editor, editorId, editingState?.markdown, isEditorMounted, location]);

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
    <ComposerWrapper className="bg-input/50" ref={composerRef}>
      <ScrollArea className="*:data-[slot=scroll-area-scrollbar]:translate-x-1.5 *:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:max-h-42">
        <Plate editor={editor}>
          <PlateContent className="p-1 outline-none" />
        </Plate>
      </ScrollArea>
      <ComposerFooter location={location} threadId={threadId} />
    </ComposerWrapper>
  );
};

type ComposerWrapperProps = useRender.ComponentProps<"div">;

export const ComposerWrapper = ({
  className,
  render,
  ...props
}: ComposerWrapperProps) => {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "w-full min-w-0 rounded-2xl border p-1.5 text-sm",
          className
        ),
      },
      props
    ),
    render,
  });
};
