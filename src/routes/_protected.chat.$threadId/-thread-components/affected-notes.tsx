import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { FileTextIcon } from "lucide-react";

import { setNoteSearchOpen, setNotesSearchOpen } from "@/components/notes-editor/use-open-note";
import { Button } from "@/components/ui/button";
import { WordDiffStats } from "@/components/word-diff";
import {
  noteQueries,
  type AffectedNoteStats,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

type AffectedNote = {
  noteId: string;
  versionIds: string[];
};

// A note written twice in one run gets a second version only when the user edited it in between.
const extractAffectedNotes = (parts: ThreadUIMessagePart[]): AffectedNote[] => {
  const byNoteId = new Map<string, AffectedNote>();

  for (const part of parts) {
    if (part.type !== "tool-createNote" && part.type !== "tool-updateNote") {
      continue;
    }

    if (part.state !== "output-available" || part.output.type === "error") {
      continue;
    }

    const affected = byNoteId.get(part.output.noteId);

    if (!affected) {
      byNoteId.set(part.output.noteId, {
        noteId: part.output.noteId,
        versionIds: [part.output.versionId],
      });
      continue;
    }

    if (!affected.versionIds.includes(part.output.versionId)) {
      affected.versionIds.push(part.output.versionId);
    }
  }

  return [...byNoteId.values()];
};

type AffectedNotesRowProps = {
  stats: AffectedNoteStats;
};

const AffectedNotesRow = ({ stats }: AffectedNotesRowProps) => (
  <li>
    <Link
      className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent"
      search={setNoteSearchOpen(stats.noteId, stats.baseVersionId ?? undefined)}
      to="."
    >
      <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{stats.title}</span>
      <WordDiffStats counts={stats.counts} />
    </Link>
  </li>
);

type AffectedNotesProps = {
  parts: ThreadUIMessagePart[];
};

export const AffectedNotes = ({ parts }: AffectedNotesProps) => {
  const gt = useGT();
  const notes = extractAffectedNotes(parts);
  const { data: stats } = useQuery({
    ...noteQueries.affected(notes.flatMap((note) => note.versionIds)),
    enabled: notes.length > 0,
  });

  if (!stats) {
    return null;
  }

  const statsByNoteId = new Map(stats.map((item) => [item.noteId, item]));
  // Every version the run wrote can be gone by the time an old message renders, pruned by the
  // version limit.
  const rows = notes.flatMap((note) => statsByNoteId.get(note.noteId) ?? []);

  if (rows.length === 0) {
    return null;
  }

  const header =
    rows.length === 1
      ? gt("Affected note")
      : gt("Affected notes ({count})", { count: rows.length });

  return (
    <div className="not-typeset mt-1 rounded-xl border border-border bg-card text-sm">
      <div className="flex items-center justify-between gap-2 py-1.5 pl-2.5 text-muted-foreground">
        <span>{header}</span>
        <Button
          className="text-muted-foreground"
          nativeButton={false}
          render={<Link search={setNotesSearchOpen(rows.map((row) => row.noteId))} to="." />}
          size="xs"
          variant="ghost"
        >
          <T>View</T>
        </Button>
      </div>
      <ul className="flex flex-col px-1 pb-1">
        {rows.map((row) => (
          <AffectedNotesRow key={row.noteId} stats={row} />
        ))}
      </ul>
    </div>
  );
};
