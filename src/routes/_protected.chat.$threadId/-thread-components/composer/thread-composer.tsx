import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { getRouteApi } from "@tanstack/react-router";
import { useGT } from "gt-tanstack-start";
import { Plate, PlateContent, useEditorMounted, usePlateEditor } from "platejs/react";
import { useCallback, useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useDragOver } from "@/hooks/use-drag-over";
import { cn } from "@/lib/utils";

import { useComposerActions } from "../../-hooks/use-composer-actions";
import { useComposerUpload } from "../../-hooks/use-composer-upload";
import type { ThreadInputLocation } from "../../../-chat-store";
import { useChatStore } from "../../../-chat-store";
import { ComposerContext, type ComposerContextValue } from "./composer-context";
import { ComposerFooter } from "./composer-footer";
import { threadEditorPlugins, getThreadEditorId, markdownToPlate } from "./plate";
import { ThreadComposerFilePlugin } from "./plate-plugins/file";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins/keyboard";
import { insertComposerClipboardText } from "./plate-plugins/paste";

type ThreadComposerProps = {
  location: ThreadInputLocation;
};

const ALLOWED_DROP_TYPES = ["Files", "text/plain"] as const;

const isAllowedDrop = (types: readonly string[]) =>
  ALLOWED_DROP_TYPES.some((type) => types.includes(type));

const Route = getRouteApi("/_protected/chat/$threadId");

export const ThreadComposer = ({ location }: ThreadComposerProps) => {
  const gt = useGT();
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

  const { cancelEditing, sendMessage, stopStream } = useComposerActions(location);
  const { uploadFiles } = useComposerUpload(threadId, location);
  const composerRef = useRef<HTMLDivElement>(null);
  const portalElementsRef = useRef(new Set<HTMLElement>());
  const { dragOverProps, isDraggingOver, handleDrop } = useDragOver();

  const registerPortal = useCallback<ComposerContextValue["registerPortal"]>((element) => {
    if (!element) return;

    portalElementsRef.current.add(element);

    return () => {
      portalElementsRef.current.delete(element);
    };
  }, []);

  useEffect(() => {
    if (location !== "edit") return;

    const handlePointerDown = (e: PointerEvent) => {
      const node = composerRef.current;
      if (!(e.target instanceof Node) || !node) return;
      if (node.contains(e.target)) return;

      for (const portal of portalElementsRef.current) {
        if (portal.contains(e.target)) return;
      }

      cancelEditing();
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [cancelEditing, location]);

  useEffect(() => {
    if (editor.meta.isFallback || !isEditorMounted) return;

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
    if (editor.meta.isFallback) return;

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
    if (editor.meta.isFallback) return;

    editor.setOption(ThreadComposerFilePlugin, "onUploadFiles", uploadFiles);

    return () => {
      editor.setOption(ThreadComposerFilePlugin, "onUploadFiles", undefined);
    };
  }, [editor, uploadFiles]);

  return (
    <ComposerContext.Provider value={{ registerPortal }}>
      <ComposerWrapper
        className={cn("bg-input/50 transition-colors", isDraggingOver && "border-ring")}
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

          if (!text) return;

          insertComposerClipboardText(editor, text);
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
              placeholder={gt("Research, compute, @ for context…")}
              className="p-1 outline-none **:data-slate-placeholder:text-muted-foreground **:data-slate-placeholder:opacity-100"
            />
          </Plate>
        </ScrollArea>
        <ComposerFooter location={location} />
      </ComposerWrapper>
    </ComposerContext.Provider>
  );
};

type ComposerWrapperProps = useRender.ComponentProps<"div">;

export const ComposerWrapper = ({ className, render, ...props }: ComposerWrapperProps) => {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn("w-full min-w-0 rounded-2xl border p-1.5 text-sm", className),
      },
      props,
    ),
    render,
  });
};
