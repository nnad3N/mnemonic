import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import {
  FileTextIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  createNote,
  deleteNote,
  addNoteToTopic,
  noteQueries,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

type NotesTabsProps = {
  onClose: () => void;
  threadId: string | undefined;
};

export const NotesTabs = ({ onClose, threadId }: NotesTabsProps) => {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeNoteId, openNoteIds, topicId } = useSearch({
    from: "/_protected",
    select: (search) => ({
      activeNoteId: search.note,
      openNoteIds: search.noteTabs,
      topicId: search.topic,
    }),
  });
  const activeNote = useQuery({
    ...noteQueries.byId(activeNoteId ?? ""),
    enabled: activeNoteId !== undefined,
  });

  const isInTopic = activeNote.data?.isInTopic === true;

  const openNote = async (noteId: string) =>
    navigate({
      search: (prev) =>
        produce(prev, (draft) => {
          draft.note = noteId;
          draft.noteTabs = openNoteIds.includes(noteId) ? openNoteIds : [...openNoteIds, noteId];
        }),
      to: ".",
    });

  const closeNote = async (noteId: string) => {
    const remaining = openNoteIds.filter((id) => id !== noteId);

    await navigate({
      search: (prev) =>
        produce(prev, (draft) => {
          draft.noteTabs = remaining;
          draft.note = draft.note === noteId ? remaining.at(-1) : draft.note;
        }),
      to: ".",
    });
  };

  const create = useMutation({
    mutationFn: async (noteThreadId: string) =>
      createNote({ data: { threadId: noteThreadId, title: gt("Untitled") } }),
    onSuccess: async (created) => openNote(created.id),
  });

  const addToTopic = useMutation({
    mutationFn: async (noteId: string) => addNoteToTopic({ data: { noteId } }),
    onError: () => {
      toast.error(gt("Failed to add the note to the topic"));
    },
    onSuccess: async (added) =>
      queryClient.invalidateQueries({ queryKey: noteQueries.byId(added.id).queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (noteId: string) => deleteNote({ data: { noteId } }),
    onError: () => {
      toast.error(gt("Failed to delete the note"));
    },
    onSuccess: async (deleted) => {
      await closeNote(deleted.id);
      queryClient.removeQueries({ queryKey: noteQueries.byId(deleted.id).queryKey });
    },
  });

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-foreground/3 pr-2 md:h-10 dark:border-white/5">
      <ScrollArea className="min-w-0 flex-1">
        <div className="flex w-max items-center">
          {openNoteIds.map((noteId) => (
            <Suspense fallback={<NoteTabFallback />} key={noteId}>
              <NoteTab
                isActive={noteId === activeNoteId}
                noteId={noteId}
                onClose={async () => closeNote(noteId)}
                onOpen={async () => openNote(noteId)}
              />
            </Suspense>
          ))}
        </div>
      </ScrollArea>
      {threadId && (
        <Button
          disabled={create.isPending}
          onClick={() => {
            create.mutate(threadId);
          }}
          size="icon-sm"
          variant="ghost"
        >
          <PlusIcon />
          <span className="sr-only">
            <T>New note</T>
          </span>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!activeNoteId}
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <MoreHorizontalIcon />
          <span className="sr-only">
            <T>Note actions</T>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          {!isInTopic && (
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={!activeNoteId || !topicId || addToTopic.isPending}
              onClick={() => {
                if (!activeNoteId) return;

                addToTopic.mutate(activeNoteId);
              }}
            >
              <FolderPlusIcon />
              <T>Add to topic</T>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={!activeNoteId || remove.isPending}
            className="whitespace-nowrap"
            onClick={() => {
              if (!activeNoteId) return;

              remove.mutate(activeNoteId);
            }}
            variant="destructive"
          >
            <Trash2Icon />
            <T>Delete note</T>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={onClose} size="icon-sm" variant="ghost">
        <PanelRightIcon />
        <span className="sr-only">
          <T>Close notes</T>
        </span>
      </Button>
    </div>
  );
};

const NoteTabFallback = () => (
  <div className="flex h-12 items-center gap-1.5 border-r border-foreground/3 pr-8 pl-3 md:h-10 dark:border-white/5">
    <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
    <Skeleton className="h-3.5 w-24" />
  </div>
);

type NoteTabProps = {
  isActive: boolean;
  noteId: string;
  onClose: () => Promise<void>;
  onOpen: () => Promise<void>;
};

const NoteTab = ({ isActive, noteId, onClose, onOpen }: NoteTabProps) => {
  const { data: title } = useSuspenseQuery({
    ...noteQueries.byId(noteId),
    select: (data) => data.title,
  });

  return (
    <div className="relative">
      <button
        className={cn(
          "peer/note-tab flex h-12 items-center gap-1.5 border-r border-foreground/3 pr-8 pl-3 text-sm text-muted-foreground md:h-10 dark:border-white/5",
          isActive && "bg-muted/40 text-foreground",
        )}
        onClick={onOpen}
        type="button"
      >
        <FileTextIcon className="size-3.5 shrink-0" />
        <span className="max-w-40 truncate">{title}</span>
      </button>
      <Button
        className={cn(
          "absolute inset-y-0 right-0 my-auto opacity-0 transition-opacity peer-hover/note-tab:opacity-100 hover:opacity-100",
          isActive && "opacity-100",
        )}
        onClick={onClose}
        size="icon-sm"
        variant="ghost"
      >
        <XIcon />
        <span className="sr-only">
          <T>Close note</T>
        </span>
      </Button>
    </div>
  );
};
