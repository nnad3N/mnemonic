import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import {
  LogOutIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";

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
  const navigate = useNavigate();
  const user = Route.useRouteContext({ select: (context) => context.user });
  const displayName = user.name || user.email;
  const initials = getInitials(displayName);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link to="/chat" />}
                    tooltip={m.nav_chat()}
                  >
                    <MessageCircleIcon aria-hidden="true" />
                    <span>{m.nav_chat()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
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
