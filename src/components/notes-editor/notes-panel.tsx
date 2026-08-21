import { useGT } from "gt-tanstack-start";
import type { RefObject } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { usePanelRef } from "react-resizable-panels";

import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import * as Kit from "@/lib/kit";
import {
  NOTES_PANEL_MAX_SIZE,
  NOTES_PANEL_WIDTH_COOKIE_MAX_AGE,
  NOTES_PANEL_WIDTH_COOKIE_NAME,
} from "@/lib/layout-consts";

import { NotesEditor } from "./notes-editor";

type NotesPanelProps = {
  minSize: string;
  onClose: () => void;
  threadPanelRef: RefObject<PanelImperativeHandle | null>;
  width: string;
};

export const NotesPanel = ({ minSize, onClose, threadPanelRef, width }: NotesPanelProps) => {
  const gt = useGT();
  const isMobile = useIsMobile();
  const panelRef = usePanelRef();

  if (isMobile) {
    return (
      <Sheet onOpenChange={onClose} open>
        <SheetContent className="w-80 p-0 sm:max-w-none [&>button]:hidden" side="right">
          <SheetHeader className="sr-only">
            <SheetTitle>{gt("Notes")}</SheetTitle>
            <SheetDescription>{gt("Displays the note editor.")}</SheetDescription>
          </SheetHeader>
          {/* Portaled out of the shell, so it does not inherit the root safe-area padding. */}
          <div className="flex h-full min-h-0 w-full flex-col pt-(--safe-top) pr-(--safe-right) pb-(--safe-bottom)">
            <NotesEditor onClose={onClose} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <ResizableHandle
        disableDoubleClick
        onDoubleClick={() => {
          const combinedWidth =
            (threadPanelRef.current?.getSize().inPixels ?? 0) +
            (panelRef.current?.getSize().inPixels ?? 0);

          if (combinedWidth === 0) return;

          panelRef.current?.resize(`${Math.round(combinedWidth / 2)}px`);
        }}
      />
      <ResizablePanel
        defaultSize={width}
        groupResizeBehavior="preserve-pixel-size"
        id="notes"
        maxSize={NOTES_PANEL_MAX_SIZE}
        minSize={minSize}
        panelRef={panelRef}
        onResize={(panelSize, _id, prevPanelSize) => {
          if (
            !prevPanelSize ||
            panelSize.inPixels === 0 ||
            panelSize.inPixels === prevPanelSize.inPixels
          ) {
            return;
          }

          Kit.cookies.set({
            name: NOTES_PANEL_WIDTH_COOKIE_NAME,
            value: `${Math.round(panelSize.inPixels)}px`,
            options: { maxAge: NOTES_PANEL_WIDTH_COOKIE_MAX_AGE },
          });
        }}
        style={{ overflow: "hidden" }}
      >
        <NotesEditor onClose={onClose} />
      </ResizablePanel>
    </>
  );
};
