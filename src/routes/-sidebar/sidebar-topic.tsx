import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  MessageCirclePlusIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { toastManager } from "@/components/ui/toast";
import { m } from "@/paraglide/messages";

import { createTopicConversation } from "../_protected.chat.$threadId/-thread.api/create-thread";
import { threadKeys } from "../_protected.chat.$threadId/-thread.api/query-keys";
import { sidebarDataQuery } from "../_protected.chat.$threadId/-thread.api/sidebar-data";
import type { SidebarTopic } from "../_protected.chat.$threadId/-thread.api/types";
import { DeleteTopicDialog, RenameTopicField } from "./sidebar-context-menu";
import { SidebarConversationItem } from "./sidebar-conversation";
import { SidebarTopicsSkeleton } from "./sidebar-skeleton";

export const SidebarTopics = () => {
  const { data, isSuccess } = useQuery(sidebarDataQuery);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{m.nav_topics()}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isSuccess ? (
            data.topics.map((topic) => (
              <SidebarTopicItem key={topic.id} topic={topic} />
            ))
          ) : (
            <SidebarTopicsSkeleton count={2} />
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

type SidebarTopicItemProps = {
  topic: SidebarTopic;
};

const SidebarTopicItem = ({ topic }: SidebarTopicItemProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const thread = await createTopicConversation({
        data: {
          title: m.nav_new_conversation_default_title(),
          topicId: topic.id,
        },
      });

      return thread;
    },
    onError: () => {
      toastManager.add({
        description: m.nav_new_conversation_error_description(),
        title: m.nav_new_conversation_error_title(),
        type: "error",
      });
    },
    onSuccess: async (thread) => {
      await navigate({
        params: { threadId: thread.id },
        to: "/chat/$threadId",
      });
      await queryClient.invalidateQueries({ queryKey: threadKeys.sidebar() });
    },
  });

  return (
    <SidebarMenuItem>
      <Collapsible className="group/topic" defaultOpen>
        <ContextMenu>
          {isRenaming ? (
            <RenameTopicField
              topicId={topic.id}
              initialValue={topic.title}
              stopRenaming={() => {
                setIsRenaming(false);
              }}
            />
          ) : (
            <ContextMenuTrigger
              render={<CollapsibleTrigger render={<SidebarMenuButton />} />}
            >
              <ChevronRightIcon
                aria-hidden="true"
                className="transition-transform group-data-panel-open/topic:rotate-90"
              />

              <span className="truncate">{topic.title}</span>
            </ContextMenuTrigger>
          )}

          <ContextMenuPopup>
            <ContextMenuItem
              onClick={() => {
                setIsRenaming(true);
              }}
            >
              <PencilIcon aria-hidden="true" />
              {m.nav_rename()}
            </ContextMenuItem>
            <ContextMenuItem
              disabled={createConversationMutation.isPending}
              onClick={() => {
                createConversationMutation.mutate();
              }}
            >
              <MessageCirclePlusIcon aria-hidden="true" />
              {m.nav_create_conversation_in_topic()}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                setDeleteOpen(true);
              }}
              variant="destructive"
            >
              <Trash2Icon aria-hidden="true" />
              {m.nav_delete()}
            </ContextMenuItem>
          </ContextMenuPopup>
        </ContextMenu>

        <CollapsibleContent>
          <SidebarMenuSub>
            {topic.threads.map((thread) => (
              <SidebarMenuSubItem key={thread.id}>
                <SidebarConversationItem
                  renderButton={(isActive) => (
                    <SidebarMenuSubButton
                      isActive={isActive}
                      render={<button className="w-full" />}
                    />
                  )}
                  thread={thread}
                />
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>

      <DeleteTopicDialog
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
        topic={topic}
      />
    </SidebarMenuItem>
  );
};
