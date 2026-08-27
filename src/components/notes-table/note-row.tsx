import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT, useLocale } from "gt-tanstack-start";
import { EllipsisVerticalIcon, EyeIcon, FolderPlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useOpenNote } from "@/components/notes-editor/use-open-note";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  addNoteToTopic,
  deleteNote,
  noteQueries,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.functions";
import type {
  NoteListItem,
  NoteScope,
} from "@/routes/_protected.chat.$threadId/-thread-api/notes.server";

type NoteRowProps = {
  canMoveToTopic: boolean;
  note: NoteListItem;
  scope: NoteScope;
};

export const NoteRow = ({ canMoveToTopic, note, scope }: NoteRowProps) => {
  const gt = useGT();
  const locale = useLocale();
  const openNote = useOpenNote();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidateList = async () =>
    queryClient.invalidateQueries({ queryKey: noteQueries.byScope(scope) });

  const moveToTopic = useMutation({
    mutationFn: async () => addNoteToTopic({ data: { noteId: note.id } }),
    onError: () => {
      toast.error(gt("Failed to move the note to the topic"));
    },
    onSuccess: invalidateList,
  });

  const remove = useMutation({
    mutationFn: async () => deleteNote({ data: { noteId: note.id } }),
    onError: () => {
      toast.error(gt("Failed to delete the note"));
    },
    onSuccess: invalidateList,
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{note.title}</TableCell>
      <TableCell className="text-muted-foreground">
        {note.lastAuthor === "agent" ? <T>Assistant</T> : <T>You</T>}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(note.updatedAt),
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" />}>
            <EllipsisVerticalIcon />
            <span className="sr-only">
              <T>Note actions</T>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            <DropdownMenuItem onClick={async () => openNote(note.id)}>
              <EyeIcon />
              <T>View</T>
            </DropdownMenuItem>
            {canMoveToTopic && (
              <DropdownMenuItem
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
              onClick={() => {
                setDeleteOpen(true);
              }}
              variant="destructive"
            >
              <Trash2Icon />
              <T>Delete note</T>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <T>Delete this note?</T>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <T>Its history goes with it. This cannot be undone.</T>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <T>Cancel</T>
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate();
              }}
            >
              <T>Delete</T>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableRow>
  );
};
