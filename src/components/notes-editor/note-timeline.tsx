import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT, useLocale } from "gt-tanstack-start";
import { RotateCcwIcon, XIcon } from "lucide-react";
import { Suspense, useState } from "react";
import type { ComponentProps, PropsWithChildren } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-media-query";
import { SIDEBAR_WIDTH_MOBILE } from "@/lib/layout-consts";
import { cn } from "@/lib/utils";
import {
  noteQueries,
  resetNoteToVersion,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
import type { NoteTimelineEntry } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

import { clearNoteDiff, closeNoteTimeline, setNoteDiffOpen } from "./use-open-note";

export const NOTE_TIMELINE_ID = "note-timeline";

const groupTimelineBlocks = (entries: NoteTimelineEntry[]): NoteTimelineEntry[][] => {
  const blocks: NoteTimelineEntry[][] = [];

  for (const entry of entries) {
    const last = blocks.at(-1);

    if (entry.author === "agent" && last?.at(-1)?.author === "agent") {
      last.push(entry);
      continue;
    }

    blocks.push([entry]);
  }

  return blocks;
};

type TimelineHeaderProps = ComponentProps<"div">;

const TimelineHeader = ({ className, ...props }: TimelineHeaderProps) => (
  <div
    className={cn("flex shrink-0 items-center justify-between gap-2 py-2 pr-2 pl-3", className)}
    {...props}
  />
);

type NoteTimelineProps = {
  noteId: string | undefined;
  open: boolean;
};

export const NoteTimeline = ({ noteId, open }: NoteTimelineProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (isMobile) {
    return (
      <Sheet
        onOpenChange={async () => navigate({ search: closeNoteTimeline, to: "." })}
        open={open && Boolean(noteId)}
      >
        <SheetContent
          className="bg-sidebar text-sidebar-foreground"
          showCloseButton={false}
          side="right"
          style={{ width: SIDEBAR_WIDTH_MOBILE }}
        >
          {/* Portaled out of the shell, so it does not inherit the root safe-area padding. */}
          <div className="flex h-full w-full flex-col pt-(--safe-top) pr-(--safe-right) pb-(--safe-bottom)">
            <TimelineHeader>
              <SheetTitle>
                <T>Timeline</T>
              </SheetTitle>
              <SheetClose render={<Button size="icon-sm" variant="ghost" />}>
                <XIcon />
                <span className="sr-only">
                  <T>Close timeline</T>
                </span>
              </SheetClose>
            </TimelineHeader>
            {noteId && (
              <Suspense>
                <NoteTimelineList noteId={noteId} />
              </Suspense>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!open || !noteId) {
    return null;
  }

  return (
    <div
      className="flex h-full w-max shrink-0 flex-col border-l border-foreground/3 max-md:hidden dark:border-white/5"
      id={NOTE_TIMELINE_ID}
    >
      <TimelineHeader className="border-b border-foreground/3 text-sm font-medium dark:border-white/5">
        <T>Timeline</T>
        <Button
          nativeButton={false}
          render={<Link search={closeNoteTimeline} to="." />}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
          <span className="sr-only">
            <T>Close timeline</T>
          </span>
        </Button>
      </TimelineHeader>
      <Suspense>
        <NoteTimelineList noteId={noteId} />
      </Suspense>
    </div>
  );
};

type NoteTimelineListProps = {
  noteId: string;
};

const NoteTimelineList = ({ noteId }: NoteTimelineListProps) => {
  const selectedDiffId = useSearch({
    from: "/_protected",
    select: (search) => search.note?.diff,
  });
  const { data } = useSuspenseQuery({
    ...noteQueries.versions(noteId),
    select: (data) => ({
      blocks: groupTimelineBlocks(data.entries),
      newestVersionId: data.entries.at(0)?.id,
    }),
  });

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="relative flex flex-col">
        <span className="absolute inset-y-5.5 left-4 z-10 w-px -translate-x-1/2 bg-f-base-500 dark:bg-f-base-600" />
        {data.blocks.map((block) => (
          <TimelineBlock
            block={block}
            key={block.at(0)?.id}
            newestVersionId={data.newestVersionId}
            noteId={noteId}
            selectedDiffId={selectedDiffId}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

type TimelineBlockProps = {
  block: NoteTimelineEntry[];
  newestVersionId: string | undefined;
  noteId: string;
  selectedDiffId: string | undefined;
};

const TimelineBlock = ({ block, newestVersionId, noteId, selectedDiffId }: TimelineBlockProps) => {
  const newest = block.at(0);
  const iterations = block.slice(1);

  if (!newest) return;

  return (
    <div className="flex flex-col">
      <TimelineRow
        entry={newest}
        newestVersionId={newestVersionId}
        noteId={noteId}
        selectedDiffId={selectedDiffId}
      >
        <span className="flex items-center gap-1.5 font-medium">
          {newest.author === "agent" ? <T>Assistant</T> : <T>You</T>}
          {iterations.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[0.625rem]/4 text-muted-foreground tabular-nums">
              +{iterations.length}
            </span>
          )}
        </span>
        <TimelineDateStamp entry={newest} />
      </TimelineRow>
      {iterations.map((entry) => (
        <TimelineRow
          entry={entry}
          isIteration
          key={entry.id}
          newestVersionId={newestVersionId}
          noteId={noteId}
          selectedDiffId={selectedDiffId}
        >
          <TimelineTimeStamp entry={entry} />
        </TimelineRow>
      ))}
    </div>
  );
};

type TimelineRowProps = PropsWithChildren<{
  entry: NoteTimelineEntry;
  isIteration?: boolean;
  newestVersionId: string | undefined;
  noteId: string;
  selectedDiffId: string | undefined;
}>;

const TimelineRow = ({
  children,
  entry,
  isIteration,
  newestVersionId,
  noteId,
  selectedDiffId,
}: TimelineRowProps) => {
  const [resetOpen, setResetOpen] = useState(false);
  const isNewest = entry.id === newestVersionId;
  const isSelected = entry.id === selectedDiffId;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <Link
            className="relative flex h-7 items-center gap-3 pr-3 pl-8 text-xs transition-colors hover:bg-muted/40"
            search={isNewest ? clearNoteDiff : setNoteDiffOpen(entry.id)}
            to="."
          />
        }
      >
        <span
          className={cn(
            "absolute top-1/2 left-4 z-20 size-2.5 shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground ring-3 ring-background",
            isIteration && "bg-f-base-500 dark:bg-f-base-600",
            isNewest && "bg-f-blue!",
            isSelected && "bg-f-orange!",
          )}
        />
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto">
        <ContextMenuItem
          disabled={isNewest}
          onClick={() => {
            setResetOpen(true);
          }}
          variant="destructive"
        >
          <RotateCcwIcon />
          <T>Reset to this version</T>
        </ContextMenuItem>
      </ContextMenuContent>
      <TimelineResetDialog
        noteId={noteId}
        onOpenChange={setResetOpen}
        open={resetOpen}
        versionId={entry.id}
      />
    </ContextMenu>
  );
};

type TimelineResetDialogProps = {
  noteId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  versionId: string;
};

const TimelineResetDialog = ({
  noteId,
  onOpenChange,
  open,
  versionId,
}: TimelineResetDialogProps) => {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const reset = useMutation({
    mutationFn: async () => {
      await resetNoteToVersion({ data: { noteId, versionId } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: noteQueries.byId(noteId).queryKey }),
        queryClient.invalidateQueries({ queryKey: noteQueries.versionLists(noteId) }),
      ]);
      await navigate({ search: clearNoteDiff, to: "." });
    },
    onError: () => {
      toast.error(gt("Failed to reset the note"));
    },
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <T>Reset the note to this version?</T>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T>Every version after it will be deleted. This cannot be undone.</T>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <T>Cancel</T>
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={reset.isPending}
            onClick={() => {
              reset.mutate();
            }}
          >
            <T>Reset</T>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

type TimelineStampProps = {
  entry: NoteTimelineEntry;
};

const TimelineDateStamp = ({ entry }: TimelineStampProps) => {
  const locale = useLocale();
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <span className="ml-auto shrink-0 text-muted-foreground">{format.format(entry.updatedAt)}</span>
  );
};

const TimelineTimeStamp = ({ entry }: TimelineStampProps) => {
  const locale = useLocale();
  const format = new Intl.DateTimeFormat(locale, { timeStyle: "medium" });

  return <span className="shrink-0 text-muted-foreground">{format.format(entry.updatedAt)}</span>;
};
