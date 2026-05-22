import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
} from "@tanstack/react-router";
import {
  ChevronRightIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import type React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { toastManager } from "@/components/ui/toast";
import { authClient } from "@/lib/better-auth/auth-client";
import { m } from "@/paraglide/messages";

import { createConversation } from "./_protected.chat.$threadId/-thread.api/create-thread";
import { threadKeys } from "./_protected.chat.$threadId/-thread.api/query-keys";
import { sidebarDataQuery } from "./_protected.chat.$threadId/-thread.api/sidebar-data";
import type { SidebarTopic } from "./_protected.chat.$threadId/-thread.api/types";

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (context.user === undefined || context.session === undefined) {
      throw redirect({ to: "/sign-in" });
    }

    return { session: context.session, user: context.user };
  },
  component: LayoutComponent,
});

/* oxlint-disable func-style */
function LayoutComponent() {
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();

  const user = Route.useRouteContext({ select: (context) => context.user });
  const displayName = user.name ?? user.email;
  const initials = getInitials(displayName);

  const { data: sidebarData } = useQuery(sidebarDataQuery);
  const conversationThreads = sidebarData?.conversationThreads ?? [];
  const topics = sidebarData?.topics ?? [];

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const thread = await createConversation({
        data: { title: m.nav_new_conversation_default_title() },
      });

      return thread;
    },
    onError: () => {
      toastManager.add({
        description: m.nav_new_thread_error_description(),
        title: m.nav_new_thread_error_title(),
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
    <SidebarProvider className="h-full min-h-0">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link to="/search">
                {({ isActive }) => (
                  <SidebarMenuButton isActive={isActive}>
                    <SearchIcon aria-hidden="true" />
                    <span>{m.nav_search()}</span>
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
                tooltip={m.nav_new_thread()}
              >
                <PlusIcon aria-hidden="true" />
                <span>{m.nav_new_thread()}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{m.nav_recent_threads()}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversationThreads.map((thread) => (
                  <SidebarMenuItem key={thread.id}>
                    <Link params={{ threadId: thread.id }} to="/chat/$threadId">
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive}>
                          <span>{thread.title}</span>
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>{m.nav_topics()}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {topics.map((topic) => (
                  <SidebarTopicItem key={topic.id} topic={topic} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
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
                    <p className="truncate font-medium text-sm">
                      {displayName}
                    </p>
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
                    <span>{m.route_error_sign_out()}</span>
                  </MenuItem>
                </MenuPopup>
              </Menu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}

function SidebarTopicItem({
  topic,
}: {
  topic: SidebarTopic;
}): React.ReactElement {
  return (
    <SidebarMenuItem>
      <Collapsible className="group/topic" defaultOpen>
        <CollapsibleTrigger render={<SidebarMenuButton />}>
          <ChevronRightIcon
            aria-hidden="true"
            className="transition-transform group-data-[panel-open]/topic:rotate-90"
          />
          <span>{topic.title}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {topic.threads.map((thread) => (
              <SidebarMenuSubItem key={thread.id}>
                <Link params={{ threadId: thread.id }} to="/chat/$threadId">
                  {({ isActive }) => (
                    <SidebarMenuSubButton isActive={isActive}>
                      {thread.title}
                    </SidebarMenuSubButton>
                  )}
                </Link>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

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
