import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
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
import { m } from "@/paraglide/messages";
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

export const RenameField = ({
  threadId,
  initialValue,
  stopRenaming,
}: RenameFieldProps) => {
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      await renameConversation({ data: { threadId, title } });
    },
    onError: () => {
      toast.error(m.nav_rename_thread_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { title: initialValue },
    onSubmit: async ({ value }) => {
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
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      await renameTopic({ data: { topicId, title } });
    },
    onError: () => {
      toast.error(m.nav_rename_topic_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
      stopRenaming();
    },
  });

  const form = useForm({
    defaultValues: { title: initialValue },
    onSubmit: async ({ value }) => {
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

export const DeleteThreadDialog = ({
  threadId,
  onOpenChange,
  open,
}: DeleteThreadDialogProps) => {
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
      toast.error(m.nav_delete_thread_error_title(), {
        description: m.common_please_try_again(),
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
            {m.nav_delete_thread_confirm_title()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {m.nav_delete_thread_confirm_description()}
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

type DeleteTopicDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  topic: SidebarTopic;
};

export const DeleteTopicDialog = ({
  onOpenChange,
  open,
  topic,
}: DeleteTopicDialogProps) => {
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
      toast.error(m.nav_delete_topic_error_title(), {
        description: m.common_please_try_again(),
      });
    },
    onSuccess: async () => {
      if (
        activeThreadId &&
        topic.threads.some((thread) => thread.id === activeThreadId)
      ) {
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
            {m.nav_delete_topic_confirm_title()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {m.nav_delete_topic_confirm_description()}
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
