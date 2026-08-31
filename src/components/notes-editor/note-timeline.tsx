import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { T, useLocale } from "gt-tanstack-start";
import { XIcon } from "lucide-react";
import type { PropsWithChildren } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { noteQueries } from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
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

type NoteTimelineProps = {
  noteId: string;
};

export const NoteTimeline = ({ noteId }: NoteTimelineProps) => {
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
    <div
      className="flex h-full w-max shrink-0 flex-col border-l border-foreground/3 dark:border-white/5"
      id={NOTE_TIMELINE_ID}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-foreground/3 pr-2 pl-3 text-sm font-medium md:h-10 dark:border-white/5">
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
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="relative flex flex-col">
          <span className="absolute inset-y-5.5 left-4 w-px -translate-x-1/2 bg-f-base-500 dark:bg-f-base-600" />
          {data.blocks.map((block) => (
            <TimelineBlock
              block={block}
              key={block.at(0)?.id}
              newestVersionId={data.newestVersionId}
              selectedDiffId={selectedDiffId}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

type TimelineBlockProps = {
  block: NoteTimelineEntry[];
  newestVersionId: string | undefined;
  selectedDiffId: string | undefined;
};

const TimelineBlock = ({ block, newestVersionId, selectedDiffId }: TimelineBlockProps) => {
  const newest = block.at(0);
  const iterations = block.slice(1);

  if (!newest) return;

  return (
    <div className="flex flex-col">
      <TimelineRow entry={newest} newestVersionId={newestVersionId} selectedDiffId={selectedDiffId}>
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
  selectedDiffId: string | undefined;
}>;

const TimelineRow = ({
  children,
  entry,
  isIteration,
  newestVersionId,
  selectedDiffId,
}: TimelineRowProps) => {
  const isNewest = entry.id === newestVersionId;
  const isSelected = entry.id === selectedDiffId;

  return (
    <Link
      className="relative flex h-7 items-center gap-3 pr-3 pl-8 text-xs transition-colors hover:bg-muted/40"
      search={isNewest ? clearNoteDiff : setNoteDiffOpen(entry.id)}
      to="."
    >
      <span
        className={cn(
          "absolute top-1/2 left-4 size-2.5 shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground ring-3 ring-background",
          isIteration && "bg-f-base-500 dark:bg-f-base-600",
          isNewest && "bg-f-blue!",
          isSelected && "bg-f-orange!",
        )}
      />
      {children}
    </Link>
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
