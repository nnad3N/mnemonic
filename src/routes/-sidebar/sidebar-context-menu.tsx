import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
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
import {
  deleteConversation,
  deleteTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/delete-thread";
import { threadKeys } from "@/routes/_protected.chat.$threadId/-thread-api/query-keys";
import {
  renameConversation,
  renameTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/rename-thread";
import type { SidebarTopic } from "@/routes/_protected.chat.$threadId/-thread-api/types";

type RenameFieldProps = {
  threadId: string;
  initialValue: string;
  stopRenaming: () => void;
};

export const RenameField = ({ threadId, initialValue, stopRenaming }: RenameFieldProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      await renameConversation({ data: { threadId, title } });
    },
    onError: () => {
      toast.error(gt("Could not rename conversation"), {
        description: gt("Please try again."),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { title: initialValue },
    onSubmit: ({ value }) => {
      const trimmed = value.title.trim();

      if (trimmed.length === 0 || trimmed === initialValue.trim()) {
        stopRenaming();
        return;
      }

      renameMutation.mutate(trimmed);
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
                stopRenaming();
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
    </form>
  );
};

type RenameTopicFieldProps = {
  topicId: string;
  initialValue: string;
  stopRenaming: () => void;
};

export const RenameTopicField = ({
  topicId,
  initialValue,
  stopRenaming,
}: RenameTopicFieldProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      await renameTopic({ data: { topicId, title } });
    },
    onError: () => {
      toast.error(gt("Could not rename topic"), {
        description: gt("Please try again."),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { title: initialValue },
    onSubmit: ({ value }) => {
      const trimmed = value.title.trim();

      if (trimmed.length === 0 || trimmed === initialValue.trim()) {
        stopRenaming();
        return;
      }

      renameMutation.mutate(trimmed);
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
                stopRenaming();
              }
            }}
            value={field.state.value}
          />
        )}
      </form.Field>
    </form>
  );
};

type DeleteThreadDialogProps = {
  threadId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export const DeleteThreadDialog = ({ threadId, onOpenChange, open }: DeleteThreadDialogProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const activeThreadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
    shouldThrow: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteConversation({ data: { threadId } });
    },
    onError: () => {
      toast.error(gt("Could not delete conversation"), {
        description: gt("Please try again."),
      });
    },
    onSuccess: async () => {
      if (activeThreadId === threadId) {
        await navigate({ to: "/search" });
      }
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
  topic: SidebarTopic;
};

export const DeleteTopicDialog = ({ onOpenChange, open, topic }: DeleteTopicDialogProps) => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const activeThreadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
    shouldThrow: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteTopic({ data: { topicId: topic.id } });
    },
    onError: () => {
      toast.error(gt("Could not delete topic"), {
        description: gt("Please try again."),
      });
    },
    onSuccess: async () => {
      if (activeThreadId && topic.threads.some((thread) => thread.id === activeThreadId)) {
        await navigate({ to: "/search" });
      }
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
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
