import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-tanstack-start";
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
  const gt = useGT();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteFile({
        data: { fileId: file.id },
      });
    },
    onError: () => {
      toast.error(gt("Could not delete file"));
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
          <AlertDialogTitle>
            <T>Delete file?</T>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T>This will permanently delete this file.</T>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            <T>Cancel</T>
          </AlertDialogCancel>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => {
              deleteMutation.mutate();
            }}
            variant="destructive"
          >
            <T>Delete</T>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
