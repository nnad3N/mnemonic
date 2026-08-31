import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { T, useLocale } from "gt-tanstack-start";
import { produce } from "immer";
import { ChevronDownIcon, ChevronRightIcon, DiffIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { noteQueries } from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
import type { NoteTimelineEntry } from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

import { NoteDiffStats } from "./note-diff-view";
import { setNoteDiffOpen } from "./use-open-note";

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
  const compareId = useSearch({
    from: "/_protected",
    select: (search) => search.note?.timeline?.compare,
  });
  const { data } = useSuspenseQuery({
    ...noteQueries.versions(noteId, compareId),
    select: (data) => ({
      blocks: groupTimelineBlocks(data.entries),
      compareVersionId: data.compareVersionId,
    }),
  });

  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-l border-foreground/3 dark:border-white/5">
      <div className="flex h-10 shrink-0 items-center px-3 text-sm font-medium">
        <T>Timeline</T>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-2">
          {data.blocks.map((block) => (
            <TimelineBlock
              block={block}
              compareVersionId={data.compareVersionId}
              key={block.at(0)?.id}
              newestVersionId={data.blocks.at(0)?.at(0)?.id}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

type TimelineBlockProps = {
  block: NoteTimelineEntry[];
  compareVersionId: string;
  newestVersionId: string | undefined;
};

const TimelineBlock = ({ block, compareVersionId, newestVersionId }: TimelineBlockProps) => {
  const [expanded, setExpanded] = useState(false);
  const newest = block.at(0);

  if (!newest) return;

  return (
    <div className="flex flex-col gap-1">
      {(expanded ? block : [newest]).map((entry) => (
        <TimelineRow
          compareVersionId={compareVersionId}
          entry={entry}
          key={entry.id}
          newestVersionId={newestVersionId}
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
  compareVersionId: string;
  entry: NoteTimelineEntry;
  newestVersionId: string | undefined;
};

const TimelineRow = ({ compareVersionId, entry, newestVersionId }: TimelineRowProps) => {
  const locale = useLocale();
  const isCompare = entry.id === compareVersionId;

  return (
    <div
      className={cn(
        "group/version-row relative rounded-md hover:bg-muted/40",
        isCompare && "bg-muted/40",
      )}
    >
      <Link
        className="block px-2 py-1.5"
        search={(prev) =>
          produce(prev, (draft) => {
            if (!draft.note?.timeline) return;

            draft.note.timeline.compare = entry.id;
          })
        }
        to="."
      >
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium">
            {entry.author === "agent" ? <T>Assistant</T> : <T>You</T>}
          </span>
          <span className="text-muted-foreground">
            {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(
              new Date(entry.updatedAt),
            )}
          </span>
        </div>
        {!isCompare && <NoteDiffStats counts={entry.counts} />}
      </Link>
      {entry.id !== newestVersionId && (
        <Button
          className="absolute top-1 right-1 opacity-0 group-hover/version-row:opacity-100"
          nativeButton={false}
          render={<Link search={setNoteDiffOpen(entry.id)} to="." />}
          size="icon-sm"
          variant="ghost"
        >
          <DiffIcon />
          <span className="sr-only">
            <T>View diff</T>
          </span>
        </Button>
      )}
    </div>
  );
};
