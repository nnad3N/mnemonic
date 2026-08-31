import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { T, useLocale } from "gt-tanstack-start";
import { ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useState } from "react";

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
      className="flex h-full w-56 shrink-0 flex-col border-l border-foreground/3 dark:border-white/5"
      id={NOTE_TIMELINE_ID}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-1 border-b border-foreground/3 pr-2 pl-3 text-sm font-medium md:h-10 dark:border-white/5">
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
        <div className="flex flex-col gap-1 p-2">
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
  const [expanded, setExpanded] = useState(false);
  const newest = block.at(0);

  if (!newest) return;

  return (
    <div className="flex flex-col gap-1">
      {(expanded ? block : [newest]).map((entry) => (
        <TimelineRow
          entry={entry}
          key={entry.id}
          newestVersionId={newestVersionId}
          selectedDiffId={selectedDiffId}
        />
      ))}
      {block.length > 1 && (
        <button
          className="flex items-center gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => {
            setExpanded((previous) => !previous);
          }}
          type="button"
        >
          {expanded ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
          {expanded ? <T>Collapse iterations</T> : <T>Show iterations</T>}
          <span className="tabular-nums">{block.length}</span>
        </button>
      )}
    </div>
  );
};

type TimelineRowProps = {
  entry: NoteTimelineEntry;
  newestVersionId: string | undefined;
  selectedDiffId: string | undefined;
};

const TimelineRow = ({ entry, newestVersionId, selectedDiffId }: TimelineRowProps) => {
  const locale = useLocale();
  const isNewest = entry.id === newestVersionId;
  const isSelected = entry.id === selectedDiffId;

  return (
    <Link
      className={cn(
        "flex items-center justify-between gap-2 rounded-md px-2 py-2 text-xs hover:bg-muted/40",
        isSelected && "bg-muted/40",
      )}
      search={isNewest ? clearNoteDiff : setNoteDiffOpen(entry.id)}
      to="."
    >
      <span className="flex items-center gap-1.5 font-medium">
        {entry.author === "agent" ? <T>Assistant</T> : <T>You</T>}
        {isNewest && <span className="size-1.5 rounded-full bg-f-blue" />}
      </span>
      <span className="text-muted-foreground">
        {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
          new Date(entry.updatedAt),
        )}
      </span>
    </Link>
  );
};
