import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  GitBranchPlusIcon,
  LogOutIcon,
  MessageCirclePlusIcon,
  MoreHorizontalIcon,
  SearchIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { toastManager } from "@/components/ui/toast";
import { authClient } from "@/lib/better-auth/auth-client";
import { m } from "@/paraglide/messages";

import {
  createConversation,
  createTopic,
} from "../_protected.chat.$threadId/-thread.api/create-thread";
import { threadKeys } from "../_protected.chat.$threadId/-thread.api/query-keys";

export const SidebarHeaderSection = () => (
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <Link to="/search">
          {({ isActive }) => (
            <SidebarMenuButton isActive={isActive}>
              <SearchIcon aria-hidden="true" />
              {m.nav_search()}
            </SidebarMenuButton>
          )}
        </Link>
      </SidebarMenuItem>
      <SidebarHeaderMenu />
    </SidebarMenu>
  </SidebarHeader>
);

type SidebarFooterSectionProps = {
  user: {
    email: string;
    image?: string | null;
    name?: string | null;
  };
};

export const SidebarFooterSection = ({ user }: SidebarFooterSectionProps) => (
  <SidebarFooter>
    <SidebarMenu>
      <SidebarFooterMenu user={user} />
    </SidebarMenu>
  </SidebarFooter>
);

const SidebarHeaderMenu = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const thread = await createConversation({
        data: { title: m.nav_new_conversation_default_title() },
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

  const createTopicMutation = useMutation({
    mutationFn: async () => {
      const thread = await createTopic({
        data: {
          conversationTitle: m.nav_new_topic_default_title(),
          topicTitle: m.nav_new_topic_default_title(),
        },
      });

      return thread;
    },
    onError: () => {
      toastManager.add({
        description: m.nav_new_topic_error_description(),
        title: m.nav_new_topic_error_title(),
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
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled={createConversationMutation.isPending}
          onClick={() => {
            createConversationMutation.mutate();
          }}
          tooltip={m.nav_new_conversation()}
        >
          <MessageCirclePlusIcon aria-hidden="true" />
          {m.nav_new_conversation()}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled={createTopicMutation.isPending}
          onClick={() => {
            createTopicMutation.mutate();
          }}
          tooltip={m.nav_new_topic()}
        >
          <GitBranchPlusIcon aria-hidden="true" />
          {m.nav_new_topic()}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
};

type SidebarFooterMenuProps = {
  user: {
    email: string;
    image?: string | null;
    name?: string | null;
  };
};

const SidebarFooterMenu = ({ user }: SidebarFooterMenuProps) => {
  const navigate = useNavigate();
  const displayName = user.name ?? user.email;
  const initials = getInitials(displayName);

  return (
    <SidebarMenuItem>
      <Menu>
        <MenuTrigger render={<SidebarMenuButton className="w-full" />}>
          <Avatar className="size-6">
            {user.image ? (
              <AvatarImage alt={displayName} src={user.image} />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-left">
            {displayName}
          </span>
          <MoreHorizontalIcon aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="start" className="w-56" side="top">
          <div className="px-2 py-1.5">
            <p className="truncate font-medium text-sm">{displayName}</p>
            <p className="truncate text-muted-foreground text-xs">
              {user.email}
            </p>
          </div>
          <MenuSeparator />
          <MenuItem
            onClick={async () => {
              await authClient.signOut();
              await navigate({ to: "/sign-in" });
            }}
          >
            <LogOutIcon aria-hidden="true" />
            {m.route_error_sign_out()}
          </MenuItem>
        </MenuPopup>
      </Menu>
    </SidebarMenuItem>
  );
};

const getInitials = (value: string): string => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "?";
  }

  const [firstPart, secondPart] = parts;

  return `${firstPart.at(0) ?? ""}${secondPart?.at(0) ?? ""}`.toUpperCase();
};
