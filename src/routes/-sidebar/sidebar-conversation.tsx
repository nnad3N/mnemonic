import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type * as React from "react";

import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";

import { sidebarConversationsQuery } from "../_protected.chat.$threadId/-thread-api/sidebar-data";
import type { SidebarThread } from "../_protected.chat.$threadId/-thread-api/types";
import { DeleteThreadDialog, RenameField } from "./sidebar-context-menu";
import { SidebarGroupEmpty } from "./sidebar-empty";
import { SidebarMore } from "./sidebar-more";
import { SidebarConversationsSkeleton } from "./sidebar-skeleton";

export const SidebarConversations = () => {
  const queryClient = useQueryClient();
  const conversationsQueryOptions = sidebarConversationsQuery();
  const conversations = useInfiniteQuery(conversationsQueryOptions);
  const conversationItems =
    conversations.data?.pages.flatMap((page) => page.items) ?? [];
  const hasMultiplePages = (conversations.data?.pages.length ?? 0) > 1;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{m.nav_recent_conversations()}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {conversations.isSuccess ? (
            conversationItems.map((thread) => (
              <SidebarMenuItem key={thread.id}>
                <SidebarConversationItem
                  renderButton={(isActive) => (
                    <SidebarMenuButton isActive={isActive} />
                  )}
                  thread={thread}
                />
              </SidebarMenuItem>
            ))
          ) : (
            <SidebarConversationsSkeleton count={4} />
          )}
          {conversations.isSuccess && conversationItems.length === 0 && (
            <SidebarGroupEmpty>{m.nav_no_conversations()}</SidebarGroupEmpty>
          )}
          {conversations.isSuccess &&
            (conversations.hasNextPage || hasMultiplePages) && (
              <SidebarMenuItem>
                <SidebarMore
                  render={SidebarMenuButton}
                  disabled={
                    conversations.isFetchingNextPage ||
                    !conversations.hasNextPage
                  }
                  onCollapse={() => {
                    queryClient.setQueryData(
                      conversationsQueryOptions.queryKey,
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
                    await conversations.fetchNextPage();
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

type SidebarConversationItemProps = {
  renderButton: (isActive: boolean) => React.ReactElement;
  thread: SidebarThread;
};

export const SidebarConversationItem = ({
  renderButton,
  thread,
}: SidebarConversationItemProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isRenaming) {
    return (
      <RenameField
        initialValue={thread.title}
        stopRenaming={() => {
          setIsRenaming(false);
        }}
        threadId={thread.id}
      />
    );
  }

  return (
    <>
      <ContextMenu>
        <Link params={{ threadId: thread.id }} to="/chat/$threadId">
          {({ isActive }) => (
            <ContextMenuTrigger render={renderButton(isActive)}>
              <span className="min-w-0 truncate">{thread.title}</span>
            </ContextMenuTrigger>
          )}
        </Link>
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

      <DeleteThreadDialog
        threadId={thread.id}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
};
