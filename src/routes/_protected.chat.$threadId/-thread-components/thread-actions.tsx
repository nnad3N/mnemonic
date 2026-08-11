import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { toast } from "sonner";
import * as v from "valibot";

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
import { Input } from "@/components/ui/input";
import type { SidebarSearch } from "@/routes/_protected";
import {
  deleteConversation,
  deleteTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/delete-thread";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import {
  renameConversation,
  renameTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/rename-thread";

type RenameFieldProps = {
  initialValue: string;
  onRename: (title: string) => Promise<void>;
  onCancel: () => void;
};

const RenameForm = ({ initialValue, onRename, onCancel }: RenameFieldProps) => {
  const form = useForm({
    defaultValues: { title: initialValue },
    onSubmit: async ({ value }) => {
      const trimmed = value.title.trim();

      if (trimmed.length === 0 || trimmed === initialValue.trim()) {
        onCancel();
        return;
      }

      await onRename(trimmed);
    },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: v.object({
        title: v.string(),
      }),
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Input
            autoFocus
            className="h-6 py-0 text-foreground"
            name={field.name}
            onBlur={() => {
              field.handleBlur();
              void form.handleSubmit();
            }}
            onChange={(event) => {
              field.handleChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
    </form>
  );
};

type RenameThreadFieldProps = {
  initialValue: string;
  onCancel: () => void;
  threadId: string;
};

export const RenameThreadField = ({ initialValue, onCancel, threadId }: RenameThreadFieldProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      await renameConversation({ data: { threadId, title } });
    },
    onError: () => {
      toast.error(gt("Could not rename conversation"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadKeys.all });
      onCancel();
    },
  });

  return (
    <RenameForm
      initialValue={initialValue}
      onRename={renameMutation.mutateAsync}
      onCancel={onCancel}
    />
  );
};

type RenameTopicFieldProps = {
  initialValue: string;
  onCancel: () => void;
  topicId: string;
};

export const RenameTopicField = ({ initialValue, onCancel, topicId }: RenameTopicFieldProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      await renameTopic({ data: { title, topicId } });
    },
    onError: () => {
      toast.error(gt("Could not rename topic"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadKeys.all });
      onCancel();
    },
  });

  return (
    <RenameForm
      initialValue={initialValue}
      onRename={renameMutation.mutateAsync}
      onCancel={onCancel}
    />
  );
};

type DeleteThreadDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  threadId: string;
};

export const DeleteThreadDialog = ({ onOpenChange, open, threadId }: DeleteThreadDialogProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteConversation({ data: { threadId } });
    },
    onError: () => {
      toast.error(gt("Could not delete conversation"));
    },
    onSuccess: async () => {
      await navigate({ to: "/" });
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <T>Delete conversation?</T>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T>This conversation and its messages will be permanently deleted.</T>
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

type DeleteTopicDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  topicId: string;
};

export const DeleteTopicDialog = ({ onOpenChange, open, topicId }: DeleteTopicDialogProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteTopic({ data: { topicId } });
    },
    onError: () => {
      toast.error(gt("Could not delete topic"));
    },
    onSuccess: async () => {
      await navigate({
        search: (prev: SidebarSearch) =>
          produce(prev, (draft) => {
            draft.topic = undefined;
          }),
        to: "/",
      });
      queryClient.removeQueries({
        exact: true,
        queryKey: threadKeys.sidebarThreads(topicId),
      });
      await queryClient.invalidateQueries({
        exact: true,
        queryKey: threadKeys.sidebarTopics(),
      });
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <T>Delete topic?</T>
          </AlertDialogTitle>
          <AlertDialogDescription>
            <T>This topic and all its conversations will be permanently deleted.</T>
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
