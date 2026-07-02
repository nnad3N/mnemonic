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
import { deleteResource } from "@/routes/_protected.topic.$topicId/-resources-api/delete-resource";
import type { ResourceItem } from "@/routes/_protected.topic.$topicId/-resources-api/list-resources";
import { topicKeys } from "@/routes/_protected.topic.$topicId/-topic-api/query-keys";

type DeleteResourceDialogProps = {
  topicId: string;
  resource: ResourceItem;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const DeleteResourceDialog = ({
  resource,
  onOpenChange,
  open,
  topicId,
}: DeleteResourceDialogProps) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteResource({
        data: { resourceId: resource.id },
      });
    },
    onError: () => {
      toast.error(m.resources_delete_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: topicKeys.resources(topicId),
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
            {m.resources_delete_confirm_title()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {m.resources_delete_confirm_description({
              name: resource.displayName,
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
