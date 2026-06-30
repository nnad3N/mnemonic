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
        {/*
          Icon-collapsed: hide list content but keep its flex space so the footer
          stays at the bottom (`hidden` would drop that space). Delay visibility
          until the width transition finishes (duration-200 on the sidebar shell).
          Reset group-label margin — SidebarGroupLabel applies -mt-8 in icon mode,
          which pulls text into the header and overflows the narrow rail when content
          still lays out.
        */}
        <SidebarContent className="group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:transition-[visibility] group-data-[collapsible=icon]:delay-200 group-data-[collapsible=icon]:duration-0 group-data-[collapsible=icon]:**:data-[sidebar=group-label]:mt-0">
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
