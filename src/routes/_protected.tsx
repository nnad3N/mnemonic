import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";

import { SidebarConversations } from "./-sidebar/sidebar-conversation";
import {
  SidebarFooterSection,
  SidebarHeaderSection,
} from "./-sidebar/sidebar-menu";
import { SidebarTopics } from "./-sidebar/sidebar-topic";

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
  const user = Route.useRouteContext({ select: (context) => context.user });

  return (
    <SidebarProvider className="h-full min-h-0">
      <Sidebar collapsible="icon">
        <SidebarHeaderSection />
        <SidebarContent>
          <SidebarConversations />
          <SidebarTopics />
        </SidebarContent>
        <SidebarFooterSection user={user} />
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
