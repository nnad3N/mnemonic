import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type * as React from "react";

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
} from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";

import { sidebarDataQuery } from "../_protected.chat.$threadId/-thread.api/sidebar-data";
import type { SidebarThread } from "../_protected.chat.$threadId/-thread.api/types";
import { DeleteThreadDialog, RenameField } from "./sidebar-context-menu";
import { SidebarConversationsSkeleton } from "./sidebar-skeleton";

export const SidebarConversations = () => {
  const { data, isSuccess } = useQuery(sidebarDataQuery);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{m.nav_recent_conversations()}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {isSuccess ? (
            data.conversations.map((thread) => (
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
              {thread.title}
            </ContextMenuTrigger>
          )}
        </Link>
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

      <DeleteThreadDialog
        threadId={thread.id}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
};
