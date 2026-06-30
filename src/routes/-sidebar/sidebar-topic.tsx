import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  FileIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
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
import { m } from "@/paraglide/messages";

import { useChatStore } from "../-chat-store";
import { createTopicConversation } from "../_protected.chat.$threadId/-thread-api/create-thread";
import { threadKeys } from "../_protected.chat.$threadId/-thread-api/query-keys";
import {
  sidebarTopicsQuery,
  sidebarTopicThreadsQuery,
} from "../_protected.chat.$threadId/-thread-api/sidebar-data";
import type { SidebarTopic } from "../_protected.chat.$threadId/-thread-api/types";
import { DeleteTopicDialog, RenameTopicField } from "./sidebar-context-menu";
import { SidebarConversationItem } from "./sidebar-conversation";
import { SidebarGroupEmpty } from "./sidebar-empty";
import { SidebarMore } from "./sidebar-more";
import { SidebarTopicsSkeleton } from "./sidebar-skeleton";

export const SidebarTopics = () => {
  const queryClient = useQueryClient();
  const topicsQueryOptions = sidebarTopicsQuery();
  const topics = useInfiniteQuery(topicsQueryOptions);
  const topicItems = topics.data?.pages.flatMap((page) => page.items) ?? [];
  const hasMultiplePages = (topics.data?.pages.length ?? 0) > 1;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{m.nav_topics()}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {topics.isSuccess ? (
            topicItems.map((topic) => (
              <SidebarTopicItem key={topic.id} topic={topic} />
            ))
          ) : (
            <SidebarTopicsSkeleton count={2} />
          )}
          {topics.isSuccess && topicItems.length === 0 && (
            <SidebarGroupEmpty>{m.nav_no_topics()}</SidebarGroupEmpty>
          )}
          {topics.isSuccess && (topics.hasNextPage || hasMultiplePages) && (
            <SidebarMenuItem>
              <SidebarMore
                render={<SidebarMenuButton />}
                disabled={topics.isFetchingNextPage || !topics.hasNextPage}
                onCollapse={() => {
                  queryClient.setQueryData(
                    topicsQueryOptions.queryKey,
                    (current) => {
                      if (!current) {
                        return current;
                      }

                      return {
                        pageParams: current.pageParams.slice(0, 1),
                        pages: current.pages.slice(0, 1),
                      };
                    }
                  );
                }}
                onMore={async () => {
                  await topics.fetchNextPage();
                }}
                showCollapse={hasMultiplePages}
              />
            </SidebarMenuItem>
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
  const isOpen = useChatStore(
    (state) => !state.collapsedTopicIds.includes(topic.id)
  );
  const setTopicCollapsed = useChatStore((state) => state.setTopicCollapsed);
  const topicThreadsQueryOptions = infiniteQueryOptions({
    ...sidebarTopicThreadsQuery(topic.id),
    initialData: {
      pageParams: [0],
      pages: [
        {
          hasMore: topic.hasMoreThreads,
          items: topic.threads,
          nextPage: topic.nextThreadsPage,
        },
      ],
    },
  });
  const topicThreads = useInfiniteQuery(topicThreadsQueryOptions);
  const threadItems = topicThreads.data.pages.flatMap((page) => page.items);
  const hasMultipleThreadPages = topicThreads.data.pages.length > 1;

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
      toast.error(m.nav_new_conversation_error_title(), {
        description: m.common_please_try_again(),
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
      <Collapsible
        className="group/topic"
        onOpenChange={(open) => {
          setTopicCollapsed(topic.id, !open);
        }}
        open={isOpen}
      >
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
            <div className="flex w-full items-center">
              <ContextMenuTrigger
                render={
                  <CollapsibleTrigger
                    render={<SidebarMenuButton className="min-w-0 flex-1" />}
                  />
                }
              >
                <ChevronRightIcon className="transition-transform group-data-panel-open/topic:rotate-90" />
                <span className="truncate">{topic.title}</span>
              </ContextMenuTrigger>
              <Button
                className="text-sidebar-foreground opacity-0 peer-hover/menu-button:opacity-100 hover:opacity-100"
                disabled={createConversationMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  createConversationMutation.mutate();
                }}
                size="icon-sm"
                variant="ghost"
              >
                <MessageSquarePlusIcon />
              </Button>
            </div>
          )}
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => {
                setIsRenaming(true);
              }}
            >
              <PencilIcon />
              {m.common_rename()}
            </ContextMenuItem>
            <ContextMenuItem
              render={
                <Link
                  params={{ topicId: topic.id }}
                  to="/topic/$topicId/artifacts"
                />
              }
            >
              <FileIcon />
              {m.nav_artifacts()}
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                setDeleteOpen(true);
              }}
              variant="destructive"
            >
              <Trash2Icon />
              {m.common_delete()}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <CollapsibleContent>
          <SidebarMenuSub>
            {threadItems.map((thread) => (
              <SidebarMenuSubItem key={thread.id}>
                <SidebarConversationItem
                  renderButton={(isActive) => (
                    <SidebarMenuSubButton
                      isActive={isActive}
                      className="w-full data-active:font-medium"
                      render={<button />}
                    />
                  )}
                  thread={thread}
                />
              </SidebarMenuSubItem>
            ))}
            {(topicThreads.hasNextPage || hasMultipleThreadPages) && (
              <SidebarMenuSubItem>
                <SidebarMore
                  render={
                    <SidebarMenuSubButton
                      render={<button className="w-full" />}
                    />
                  }
                  disabled={
                    topicThreads.isFetchingNextPage || !topicThreads.hasNextPage
                  }
                  onCollapse={() => {
                    queryClient.setQueryData(
                      topicThreadsQueryOptions.queryKey,
                      (current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          pageParams: current.pageParams.slice(0, 1),
                          pages: current.pages.slice(0, 1),
                        };
                      }
                    );
                  }}
                  onMore={async () => {
                    await topicThreads.fetchNextPage();
                  }}
                  showCollapse={hasMultipleThreadPages}
                />
              </SidebarMenuSubItem>
            )}
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
