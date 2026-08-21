import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ClientOnly, getRouteApi, useHydrated } from "@tanstack/react-router";
import { useGT } from "gt-tanstack-start";
import {
  Plate,
  PlateContent,
  useEditorComposing,
  useEditorMounted,
  useEditorRef,
  usePlateEditor,
} from "platejs/react";
import type { ReactNode, RefObject } from "react";
import { Suspense, useCallback, useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useDragOver } from "@/hooks/use-drag-over";
import * as Kit from "@/lib/kit";
import { markdownToPlate } from "@/lib/plate";
import { cn } from "@/lib/utils";

import { useComposerActions, useIsComposerEmpty } from "../../-hooks/use-composer-actions";
import { useComposerUpload } from "../../-hooks/use-composer-upload";
import type { ThreadInputLocation } from "../../../-chat-store";
import { useChatStore } from "../../../-chat-store";
import { ComposerContext, type ComposerContextValue } from "./composer-context";
import { ComposerFooter } from "./composer-footer";
import { getThreadEditorId, threadEditorPlugins } from "./plate";
import { ThreadComposerFilePlugin } from "./plate-plugins/file";
import { ThreadComposerKeyboardPlugin } from "./plate-plugins/keyboard";
import { insertComposerClipboardText } from "./plate-plugins/paste";

type ThreadComposerProps = {
  location: ThreadInputLocation;
};

const AllowedDropType = Kit.literals.from()(["Files", "text/plain"]);

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
    value: (plate) => {
      if (location === "edit") {
        const markdown = useChatStore.getState().editingState?.markdown;

        if (markdown) {
          return markdownToPlate(plate, markdown);
        }
      }

      if (location === "main") {
        const draft = useChatStore.getState().composerState.get(threadId)?.value;

        if (draft) {
          return draft;
        }
      }

      return plate.api.create.value();
    },
  });
  const isEditorMounted = useEditorMounted(editorId);
  const isHydrated = useHydrated();
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
    if (editor.meta.isFallback || !isEditorMounted || !isHydrated) return;

    editor.tf.focus({ edge: "endEditor" });
  }, [editor, isEditorMounted, isHydrated]);

  return (
    <ComposerContext.Provider value={{ registerPortal }}>
      <ComposerWrapper
        className={cn("bg-input/50 transition-colors", isDraggingOver && "border-ring")}
        data-test-id={`thread-composer-${location}`}
        {...dragOverProps}
        onDragOverCapture={(e) => {
          e.preventDefault();

          if (
            !e.dataTransfer.types.some((type) => AllowedDropType.is(type)) ||
            editor.meta.isFallback
          ) {
            e.dataTransfer.dropEffect = "none";
            return;
          }

          e.dataTransfer.dropEffect = "copy";
        }}
        onDropCapture={handleDrop(async (e) => {
          const files = [...e.dataTransfer.files];

          if (files.length > 0) {
            // Set by ComposerBindings, so a drop before the chat query resolves
            // is a no-op rather than an error.
            await editor.getOption(ThreadComposerFilePlugin, "onUploadFiles")?.(files);
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
            // Not PlateContent's `disabled`/`readOnly`: those write through to
            // `editor.dom.readOnly`, which Plate reads back into the store, so the
            // first read-only render latches and never releases.
            readOnly={!isHydrated}
          >
            <div className={cn("relative transition-opacity", !isHydrated && "opacity-50")}>
              <ComposerPlaceholder>{gt("Research, compute, @ for context…")}</ComposerPlaceholder>
              <PlateContent
                data-test-id="thread-composer-editor"
                onDrop={(e) => {
                  e.preventDefault();
                  return true;
                }}
                className="p-1 outline-none"
              />
            </div>
          </Plate>
        </ScrollArea>
        <ComposerFooter location={location} />
      </ComposerWrapper>
      <ClientOnly>
        <Suspense fallback={null}>
          <ComposerBindings
            composerRef={composerRef}
            location={location}
            portalElementsRef={portalElementsRef}
          />
        </Suspense>
      </ClientOnly>
    </ComposerContext.Provider>
  );
};

type ComposerPlaceholderProps = {
  children: ReactNode;
};

/**
 * Replaces slate's built-in `placeholder`, which only paints itself from an
 * effect and so is missing from the server render and the hydration pass.
 * Rendered inside `<Plate>` so the editor store resolves on the first render.
 */
const ComposerPlaceholder = ({ children }: ComposerPlaceholderProps) => {
  const isEditorEmpty = useIsComposerEmpty();
  // IME composition text is not in the editor value yet, so an empty editor
  // would otherwise show the placeholder underneath what is being typed.
  const isComposing = useEditorComposing();

  if (!isEditorEmpty || isComposing) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-s-0 top-0 p-1 text-muted-foreground/75 select-none"
    >
      {children}
    </span>
  );
};

type ComposerBindingsProps = {
  composerRef: RefObject<HTMLDivElement | null>;
  location: ThreadInputLocation;
  portalElementsRef: RefObject<Set<HTMLElement>>;
};

/**
 * Wires the chat-backed behaviour onto the editor. It renders nothing itself and
 * mounts only on the client, so the chrome above can server-render — until it
 * mounts, the composer is inert.
 */
const ComposerBindings = ({ composerRef, location, portalElementsRef }: ComposerBindingsProps) => {
  const threadId = Route.useParams({
    select: (params) => params.threadId,
  });
  const editor = useEditorRef(getThreadEditorId(threadId, location));
  const { cancelEditing, sendMessage, stopStream } = useComposerActions(location);
  const { uploadFiles } = useComposerUpload(threadId, location);

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
  }, [cancelEditing, composerRef, location, portalElementsRef]);

  useEffect(() => {
    if (editor.meta.isFallback) return;

    editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", sendMessage);
    editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", cancelEditing);
    editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", stopStream);
    editor.setOption(ThreadComposerFilePlugin, "onUploadFiles", uploadFiles);

    return () => {
      editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", undefined);
      editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", undefined);
      editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", undefined);
      editor.setOption(ThreadComposerFilePlugin, "onUploadFiles", undefined);
    };
  }, [cancelEditing, editor, sendMessage, stopStream, uploadFiles]);

  return null;
};

type ComposerWrapperProps = useRender.ComponentProps<"div">;

export const ComposerWrapper = ({ className, render, ...props }: ComposerWrapperProps) => {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn("w-full min-w-0 rounded-xl border p-1.5 text-sm", className),
      },
      props,
    ),
    render,
  });
};
