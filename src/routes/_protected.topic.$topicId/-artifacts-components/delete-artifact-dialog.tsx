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
import { deleteArtifact } from "@/routes/_protected.topic.$topicId/-artifacts-api/delete-artifact";
import type { ArtifactItem } from "@/routes/_protected.topic.$topicId/-artifacts-api/list-artifacts";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

type DeleteArtifactDialogProps = {
  topicId: string;
  artifact: ArtifactItem;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const DeleteArtifactDialog = ({
  artifact,
  onOpenChange,
  open,
  topicId,
}: DeleteArtifactDialogProps) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteArtifact({
        data: { artifactId: artifact.id, topicId },
      });
    },
    onError: () => {
      toast.error(m.artifacts_delete_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: topicKeys.artifacts(topicId),
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
            {m.artifacts_delete_confirm_title()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {m.artifacts_delete_confirm_description({
              name: artifact.displayName,
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
