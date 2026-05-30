import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronsUpDownIcon,
  GitBranchPlusIcon,
  LogOutIcon,
  MessageCirclePlusIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/better-auth/auth-client";
import { m } from "@/paraglide/messages";

import {
  createConversation,
  createTopic,
} from "../_protected.chat.$threadId/-thread.api/create-thread";
import { threadKeys } from "../_protected.chat.$threadId/-thread.api/query-keys";

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

export const SidebarHeaderSection = () => {
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
      toast.error(m.nav_new_conversation_error_title(), {
        description: m.nav_new_conversation_error_description(),
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
      toast.error(m.nav_new_topic_error_title(), {
        description: m.nav_new_topic_error_description(),
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
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <Link to="/search">
            {({ isActive }) => (
              <SidebarMenuButton isActive={isActive}>
                <SearchIcon />
                {m.nav_search()}
              </SidebarMenuButton>
            )}
          </Link>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            disabled={createConversationMutation.isPending}
            onClick={() => {
              createConversationMutation.mutate();
            }}
            tooltip={m.nav_new_conversation()}
          >
            <MessageCirclePlusIcon />
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
            <GitBranchPlusIcon />
            {m.nav_new_topic()}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
};

type SidebarFooterSectionProps = {
  user: {
    email: string;
    image?: string | null;
    name?: string | null;
  };
};

export const SidebarFooterSection = ({ user }: SidebarFooterSectionProps) => {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const displayName = user.name ?? user.email;
  const initials = getInitials(displayName);

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                />
              }
            >
              <Avatar>
                <AvatarImage alt={displayName} src={user.image ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut();
                    await navigate({ to: "/sign-in" });
                  }}
                >
                  <LogOutIcon />
                  {m.route_error_sign_out()}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
};
