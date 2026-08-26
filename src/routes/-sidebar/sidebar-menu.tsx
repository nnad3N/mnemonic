import { Link, useNavigate } from "@tanstack/react-router";
import { T, useLocale, useSetLocale } from "gt-tanstack-start";
import {
  ChevronsUpDownIcon,
  DownloadIcon,
  LanguagesIcon,
  LaptopIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { authClient } from "@/lib/better-auth/auth-client";

const getInitials = (value: string): string => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "?";
  }

  return `${parts.at(0)?.at(0) ?? ""}${parts.at(1)?.at(0) ?? ""}`.toUpperCase();
};

type SidebarFooterSectionProps = {
  user: {
    email: string;
    image?: string | null;
    name?: string | null;
    role?: string | null;
  };
};

export const SidebarFooterSection = ({ user }: SidebarFooterSectionProps) => {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { canInstall, needsManualInstall, promptInstall } = useInstallPrompt();
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
                <DropdownMenuItem render={<Link to="/settings" />}>
                  <SettingsIcon />
                  <T>Settings</T>
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem render={<Link to="/settings/admin" />}>
                    <ShieldIcon />
                    <T>Admin</T>
                  </DropdownMenuItem>
                )}
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
                {canInstall && (
                  <DropdownMenuItem
                    onClick={async () => {
                      await promptInstall();
                    }}
                  >
                    <DownloadIcon />
                    <T>Install app</T>
                  </DropdownMenuItem>
                )}
                {needsManualInstall && (
                  <DropdownMenuLabel className="font-normal text-muted-foreground">
                    <T>To install: Share, then Add to Home Screen.</T>
                  </DropdownMenuLabel>
                )}
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
