import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { FileIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { navigateToScopeThread } from "@/routes/-sidebar/navigate-to-scope-thread";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";
import type { SidebarSearch } from "@/routes/_protected";
import { threadQueries } from "@/routes/_protected.chat.$threadId/-hooks/use-thread-chat";
import { mentionQueries } from "@/routes/_protected.chat.$threadId/-thread-api/mentions.functions";
import {
  deleteConversation,
  deleteTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/thread.functions";
import {
  renameConversation,
  renameTopic,
} from "@/routes/_protected.chat.$threadId/-thread-api/thread.functions";

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
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Input
            autoFocus
            className="h-6 py-0 text-foreground"
            name={field.name}
            onBlur={async () => {
              field.handleBlur();
              await form.handleSubmit();
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sidebarQueries.all() }),
        queryClient.invalidateQueries({ queryKey: threadQueries.all() }),
        queryClient.invalidateQueries({ queryKey: mentionQueries.all() }),
      ]);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sidebarQueries.all() }),
        queryClient.invalidateQueries({ queryKey: threadQueries.all() }),
        queryClient.invalidateQueries({ queryKey: mentionQueries.all() }),
      ]);
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
  const topicId = useSearch({ from: "/_protected", select: (search) => search.topic });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteConversation({ data: { threadId } });
    },
    onError: () => {
      toast.error(gt("Could not delete conversation"));
    },
    onSuccess: async () => {
      queryClient.setQueryData(
        sidebarQueries.threads(topicId).queryKey,
        (current) => current?.filter((thread) => thread.id !== threadId) ?? [],
      );
      await navigateToScopeThread({ navigate, queryClient, topicId });
      await queryClient.invalidateQueries({ queryKey: sidebarQueries.all() });
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

type ThreadContextMenuProps = {
  children: ReactNode | ((isActive: boolean) => ReactNode);
  render: ReactElement | ((isActive: boolean) => ReactElement);
  threadId: string;
  title: string;
};

export const ThreadContextMenu = ({
  children,
  render,
  threadId,
  title,
}: ThreadContextMenuProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isRenaming) {
    return (
      <RenameThreadField
        initialValue={title}
        onCancel={() => {
          setIsRenaming(false);
        }}
        threadId={threadId}
      />
    );
  }

  return (
    <>
      <ContextMenu>
        {/* oxlint-disable anti-slop/no-runtime-typeof */}
        {typeof render === "function" ? (
          <Link params={{ threadId }} to="/chat/$threadId">
            {({ isActive }) => (
              <ContextMenuTrigger render={render(isActive)}>
                {typeof children === "function" ? children(isActive) : children}
              </ContextMenuTrigger>
            )}
          </Link>
        ) : (
          <ContextMenuTrigger render={render}>
            {typeof children === "function" ? children(false) : children}
          </ContextMenuTrigger>
        )}
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => {
              setIsRenaming(true);
            }}
          >
            <PencilIcon />
            <T>Rename</T>
          </ContextMenuItem>
          <ContextMenuItem render={<Link params={{ threadId }} to="/chat/$threadId/notes" />}>
            <FileIcon />
            <T>Notes</T>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setDeleteOpen(true);
            }}
            variant="destructive"
          >
            <Trash2Icon />
            <T>Delete</T>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteThreadDialog onOpenChange={setDeleteOpen} open={deleteOpen} threadId={threadId} />
    </>
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
        queryKey: sidebarQueries.threads(topicId).queryKey,
      });
      await queryClient.invalidateQueries({
        exact: true,
        queryKey: sidebarQueries.topics().queryKey,
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
