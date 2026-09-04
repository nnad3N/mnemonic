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
import { mentionQueries } from "@/routes/_protected.chat.$threadId/-thread-api/mentions.functions";
import { deleteFile } from "@/routes/_protected.topic.$topicId/-files/files.functions";
import type { FileItem } from "@/routes/_protected.topic.$topicId/-files/files.functions";
import { fileQueries } from "@/routes/_protected.topic.$topicId/-files/files.functions";

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
          queryKey: fileQueries.byTopic(topicId),
        }),
        queryClient.invalidateQueries({
          queryKey: mentionQueries.listBase(),
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
