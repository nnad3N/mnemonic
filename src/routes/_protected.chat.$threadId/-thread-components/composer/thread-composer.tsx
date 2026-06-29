import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { getRouteApi } from "@tanstack/react-router";
import {
  Plate,
  PlateContent,
  useEditorMounted,
  usePlateEditor,
} from "platejs/react";
import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useDragOver } from "@/hooks/use-drag-over";
import { cn } from "@/lib/utils";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { useComposerUpload } from "../../-hooks/use-composer-upload";
import type { ThreadInputLocation } from "../../../-chat-store";
import { useChatStore } from "../../../-chat-store";
import { ComposerFooter } from "./composer-footer";
import {
  threadEditorPlugins,
  getThreadEditorId,
  markdownToPlate,
} from "./plate";
import { ThreadComposerFilePlugin } from "./plate-plugins/file";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins/keyboard";
import {
  insertComposerLink,
  parseComposerLinkPasteSegments,
} from "./plate-plugins/link";

type ThreadComposerProps = {
  location: ThreadInputLocation;
};

const ALLOWED_DROP_TYPES = ["Files", "text/plain"] as const;

const isAllowedDrop = (types: readonly string[]) =>
  ALLOWED_DROP_TYPES.some((type) => types.includes(type));

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
  const isEditorMounted = useEditorMounted(editorId);

  const { cancelEditing, sendMessage, stopStream } =
    useComposerActions(location);
  const { uploadFiles } = useComposerUpload(threadId, location);
  const composerRef = useRef<HTMLDivElement>(null);
  const { dragOverProps, isDraggingOver, handleDrop } = useDragOver();

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

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [cancelEditing, location]);

  useEffect(() => {
    if (editor.meta.isFallback || !isEditorMounted) {
      return;
    }

    const { editingState, composerState } = useChatStore.getState();
    const persisted = composerState.get(threadId);

    if (location === "main" && persisted) {
      editor.tf.setValue(persisted.value);
    }

    if (location === "edit" && editingState?.markdown) {
      editor.tf.setValue(markdownToPlate(editor, editingState.markdown));
    }

    editor.tf.focus({ edge: "endEditor" });
  }, [editor, isEditorMounted, location, threadId]);

  useEffect(() => {
    if (editor.meta.isFallback) {
      return;
    }

    editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", sendMessage);
    editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", cancelEditing);
    editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", stopStream);

    return () => {
      editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", undefined);
      editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", undefined);
      editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", undefined);
    };
  }, [cancelEditing, editor, sendMessage, stopStream]);

  useEffect(() => {
    if (editor.meta.isFallback) {
      return;
    }

    editor.setOption(ThreadComposerFilePlugin, "onUploadFiles", uploadFiles);

    return () => {
      editor.setOption(ThreadComposerFilePlugin, "onUploadFiles", undefined);
    };
  }, [editor, uploadFiles]);

  return (
    <ComposerWrapper
      className={cn(
        "bg-input/50 transition-colors",
        isDraggingOver && "border-ring"
      )}
      {...dragOverProps}
      onDragOverCapture={(e) => {
        e.preventDefault();

        if (!isAllowedDrop(e.dataTransfer.types) || editor.meta.isFallback) {
          e.dataTransfer.dropEffect = "none";
          return;
        }

        e.dataTransfer.dropEffect = "copy";
      }}
      onDropCapture={handleDrop(async (e) => {
        const files = [...e.dataTransfer.files];

        if (files.length > 0) {
          await uploadFiles(files);
          return;
        }

        const text = e.dataTransfer.getData("text/plain");
        const segments = parseComposerLinkPasteSegments(text);

        if (!segments) {
          return;
        }

        for (const [index, segment] of segments.entries()) {
          if (segment.type === "text") {
            editor.tf.insertText(segment.text);
            continue;
          }

          insertComposerLink(editor, segment.url.href, {
            trailingSpace: index === segments.length - 1,
          });
        }
      })}
      ref={composerRef}
    >
      <ScrollArea className="*:data-[slot=scroll-area-scrollbar]:translate-x-1.5 *:data-[slot=scroll-area-viewport]:h-auto *:data-[slot=scroll-area-viewport]:max-h-42">
        <Plate
          editor={editor}
          onChange={({ value }) => {
            if (location === "main") {
              useChatStore.getState().setComposerValue(threadId, value);
            }
          }}
        >
          <PlateContent
            onDrop={(e) => {
              e.preventDefault();
              return true;
            }}
            className="p-1 outline-none"
          />
        </Plate>
      </ScrollArea>
      <ComposerFooter location={location} />
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
