import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CatchBoundary, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import {
  FileIcon,
  FileQuestionMarkIcon,
  FileTextIcon,
  FolderPlusIcon,
  HistoryIcon,
  MessageSquareTextIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";
import {
  addNoteToTopic,
  createNote,
  deleteNote,
  noteQueries,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";

import { NoteExportSubmenu } from "./export-submenu";
import { useOpenNote } from "./use-open-note";

type NotesTabsProps = {
  onClose: () => void;
  threadId: string | undefined;
};

export const NotesTabs = ({ onClose, threadId }: NotesTabsProps) => {
  const gt = useGT();
  const navigate = useNavigate();
  const openNote = useOpenNote();
  const { activeNoteId, openNoteIds, topicId } = useSearch({
    from: "/_protected",
    select: (search) => ({
      activeNoteId: search.note?.id,
      openNoteIds: search.noteTabs,
      topicId: search.topic,
    }),
  });
  const closeNote = async (noteId: string) => {
    const remaining = openNoteIds.filter((id) => id !== noteId);

    await navigate({
      search: (prev) =>
        produce(prev, (draft) => {
          draft.noteTabs = remaining;

          if (draft.note?.id !== noteId) return;

          const nextId = remaining.at(-1);

          draft.note = nextId ? { id: nextId, timeline: draft.note.timeline } : undefined;
        }),
      to: ".",
    });
  };

  const create = useMutation({
    mutationFn: async (noteThreadId: string) =>
      createNote({ data: { threadId: noteThreadId, title: gt("Untitled") } }),
    onSuccess: async (created) => openNote(created.id),
  });

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-foreground/3 pr-2 md:h-10 dark:border-white/5">
      <HorizontalScroller className="flex-1">
        <div className="flex w-max items-center">
          {openNoteIds.map((noteId) => (
            <NoteTab
              isActive={noteId === activeNoteId}
              key={noteId}
              noteId={noteId}
              onClose={async () => closeNote(noteId)}
              onOpen={async () => openNote(noteId)}
              threadId={threadId}
              topicId={topicId}
            />
          ))}
        </div>
      </HorizontalScroller>
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
          {activeNoteId && (
            <NoteMenuItems noteId={activeNoteId} onCloseTab={async () => closeNote(activeNoteId)} />
          )}
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

type NoteMenuItemsProps = {
  noteId: string;
  onCloseTab: () => Promise<void>;
};

const NoteMenuItems = ({ noteId, onCloseTab }: NoteMenuItemsProps) => {
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeNoteId = useSearch({ from: "/_protected", select: (search) => search.note?.id });
  const note = useQuery(noteQueries.byId(noteId));

  const moveToTopic = useMutation({
    mutationFn: async () => addNoteToTopic({ data: { noteId } }),
    onError: () => {
      toast.error(gt("Failed to move the note to the topic"));
    },
    onSuccess: async (added) =>
      queryClient.invalidateQueries({ queryKey: noteQueries.byId(added.id).queryKey }),
  });

  const remove = useMutation({
    mutationFn: async () => deleteNote({ data: { noteId } }),
    onError: () => {
      toast.error(gt("Failed to delete the note"));
    },
    onSuccess: async () => {
      await onCloseTab();
      queryClient.removeQueries({ queryKey: noteQueries.byId(noteId).queryKey });
    },
  });

  const goToThread = async () => {
    if (!note.isSuccess) return;

    if (note.data.scope.type === "thread") {
      await navigate({
        params: { threadId: note.data.scope.id },
        search: (prev) =>
          produce(prev, (draft) => {
            draft.note = { id: noteId };
            draft.topic = note.data.threadTopicId ?? undefined;
          }),
        to: "/chat/$threadId",
      });

      return;
    }

    const noteTopicId = note.data.scope.id;
    const threads = await queryClient.ensureQueryData(sidebarQueries.threads(noteTopicId));
    const latest = threads.at(0);

    if (!latest) return;

    await navigate({
      params: { threadId: latest.id },
      search: (prev) =>
        produce(prev, (draft) => {
          draft.note = { id: noteId };
          draft.topic = noteTopicId;
        }),
      to: "/chat/$threadId",
    });
  };

  return (
    <>
      <DropdownMenuItem
        className="whitespace-nowrap"
        disabled={!note.isSuccess}
        onClick={goToThread}
      >
        <MessageSquareTextIcon />
        <T>Go to thread</T>
      </DropdownMenuItem>
      {noteId === activeNoteId && (
        <DropdownMenuItem
          className="whitespace-nowrap"
          nativeButton={false}
          render={
            <Link
              search={(prev) =>
                produce(prev, (draft) => {
                  if (!draft.note) return;

                  draft.note.timeline = draft.note.timeline ? undefined : true;
                })
              }
              to="."
            />
          }
        >
          <HistoryIcon />
          <T>Timeline</T>
        </DropdownMenuItem>
      )}
      {note.isSuccess && noteId === activeNoteId && <NoteExportSubmenu title={note.data.title} />}
      {note.isSuccess && note.data.threadTopicId && (
        <DropdownMenuItem
          className="whitespace-nowrap"
          disabled={moveToTopic.isPending}
          onClick={() => {
            moveToTopic.mutate();
          }}
        >
          <FolderPlusIcon />
          <T>Move to topic</T>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        className="whitespace-nowrap"
        disabled={remove.isPending}
        onClick={() => {
          remove.mutate();
        }}
        variant="destructive"
      >
        <Trash2Icon />
        <T>Delete note</T>
      </DropdownMenuItem>
    </>
  );
};

type NoteTabProps = {
  isActive: boolean;
  noteId: string;
  onClose: () => Promise<void>;
  onOpen: () => Promise<void>;
  threadId: string | undefined;
  topicId: string | undefined;
};

const NoteTab = ({ isActive, noteId, onClose, onOpen, threadId, topicId }: NoteTabProps) => (
  <div className="relative">
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            className={cn(
              "peer/note-tab flex h-12 items-center gap-1.5 border-r border-foreground/3 pr-8 pl-3 text-sm text-muted-foreground md:h-10 dark:border-white/5",
              isActive && "bg-muted/40 text-foreground",
            )}
            onClick={onOpen}
            type="button"
          />
        }
      >
        <CatchBoundary errorComponent={NoteTabTitleError} getResetKey={() => noteId}>
          <Suspense
            fallback={
              <>
                <FileIcon className="size-3.5 shrink-0" />
                <Skeleton className="h-3.5 w-24" />
              </>
            }
          >
            <NoteTabTitle noteId={noteId} threadId={threadId} topicId={topicId} />
          </Suspense>
        </CatchBoundary>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <NoteMenuItems noteId={noteId} onCloseTab={onClose} />
      </ContextMenuContent>
    </ContextMenu>
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

type NoteTabTitleProps = {
  noteId: string;
  threadId: string | undefined;
  topicId: string | undefined;
};

const NoteTabTitle = ({ noteId, threadId, topicId }: NoteTabTitleProps) => {
  const { data: note } = useSuspenseQuery({
    ...noteQueries.byId(noteId),
    select: (data) => ({ scope: data.scope, title: data.title }),
  });
  const isInTopic = note.scope.type === "topic";
  const isLocal = note.scope.id === (isInTopic ? topicId : threadId);

  return (
    <>
      {!isLocal ? (
        <FileQuestionMarkIcon className="size-3.5 shrink-0" />
      ) : isInTopic ? (
        <FileTextIcon className="size-3.5 shrink-0" />
      ) : (
        <FileIcon className="size-3.5 shrink-0" />
      )}
      <span className="max-w-40 truncate">{note.title}</span>
    </>
  );
};

const NoteTabTitleError = () => (
  <>
    <FileIcon className="size-3.5 shrink-0" />
    <span className="max-w-40 truncate text-destructive">
      <T>Unavailable</T>
    </span>
  </>
);
