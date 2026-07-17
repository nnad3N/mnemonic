import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import { deleteFile } from "@/routes/_protected.topic.$topicId/-files-api/delete-file";
import type { FileItem } from "@/routes/_protected.topic.$topicId/-files-api/list-files";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

type DeleteFileDialogProps = {
  topicId: string;
  file: FileItem;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const DeleteFileDialog = ({ file, onOpenChange, open, topicId }: DeleteFileDialogProps) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteFile({
        data: { fileId: file.id },
      });
    },
    onError: () => {
      toast.error(m.files_delete_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: topicKeys.files(topicId),
        }),
        queryClient.invalidateQueries({
          queryKey: threadKeys.mentions(topicId),
        }),
      ]);
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.files_delete_confirm_title()}</AlertDialogTitle>
          <AlertDialogDescription>
            {m.files_delete_confirm_description({
              name: file.displayName,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            {m.common_cancel()}
          </AlertDialogCancel>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate();
            }}
            variant="destructive"
          >
            {m.common_delete()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
