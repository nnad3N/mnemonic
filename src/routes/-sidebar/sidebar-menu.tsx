import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { T, useGT, useLocale, useSetLocale } from "gt-tanstack-start";
import {
  ChevronsUpDownIcon,
  LanguagesIcon,
  LaptopIcon,
  LogOutIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

import {
  createConversation,
  createTopic,
} from "../_protected.chat.$threadId/-thread-api/create-thread";
import { threadKeys } from "../_protected.chat.$threadId/-thread-api/query-keys";

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
  const gt = useGT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const thread = await createConversation({
        data: { title: gt("New conversation") },
      });

      return thread;
    },
    onError: () => {
      toast.error(gt("Could not create conversation"), {
        description: gt("Please try again."),
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
          conversationTitle: gt("New conversation"),
          topicTitle: gt("New topic"),
        },
      });

      return thread;
    },
    onError: () => {
      toast.error(gt("Could not create topic"), {
        description: gt("Please try again."),
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
                <T>Search</T>
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
            tooltip={gt("New conversation")}
          >
            <MessageSquareTextIcon />
            <T>New conversation</T>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            disabled={createTopicMutation.isPending}
            onClick={() => {
              createTopicMutation.mutate();
            }}
            tooltip={gt("New topic")}
          >
            <MessagesSquareIcon />
            <T>New topic</T>
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
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { setTheme, theme } = useTheme();
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
              side={isMobile ? "bottom" : "top"}
              align={isMobile ? "end" : "center"}
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <SunIcon />
                    <T>Theme</T>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={theme ?? "system"}
                      onValueChange={(value) => {
                        setTheme(value);
                      }}
                    >
                      <DropdownMenuRadioItem value="light">
                        <SunIcon />
                        <T>Light</T>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="dark">
                        <MoonIcon />
                        <T>Dark</T>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="system">
                        <LaptopIcon />
                        <T>System</T>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <LanguagesIcon />
                    <T>Language</T>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup onValueChange={setLocale} value={locale}>
                      <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="pl">Polski</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut();
                    await navigate({ to: "/sign-in" });
                  }}
                >
                  <LogOutIcon />
                  <T>Sign out</T>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
};
