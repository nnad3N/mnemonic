import { Outlet, createFileRoute, redirect, retainSearchParams } from "@tanstack/react-router";
import * as v from "valibot";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { SidebarFooterSection } from "./-sidebar/sidebar-menu";
import { SidebarScopeCombobox } from "./-sidebar/sidebar-scope-combobox";
import { SidebarThreadList } from "./-sidebar/sidebar-thread-list";
import { SidebarThreadSearch } from "./-sidebar/sidebar-thread-search";

const sidebarSearchSchema = v.object({
  topic: v.optional(v.pipe(v.string(), v.nanoid())),
  q: v.optional(v.string(), ""),
  range: v.optional(
    v.union([v.picklist(["today", "7d", "30d"]), v.object({ from: v.string(), to: v.string() })]),
  ),
});

export type SidebarSearch = v.InferInput<typeof sidebarSearchSchema>;

export const Route = createFileRoute("/_protected")({
  beforeLoad: ({ context }) => {
    if (!context.user || !context.session) {
      throw redirect({ to: "/sign-in" });
    }

    return { session: context.session, user: context.user };
  },
  component: LayoutComponent,
  search: { middlewares: [retainSearchParams(["topic", "q", "range"])] },
  validateSearch: sidebarSearchSchema,
});

function LayoutComponent() {
  const user = Route.useRouteContext({ select: (context) => context.user });

  return (
    <SidebarProvider className="h-full min-h-0">
      <Sidebar collapsible="icon">
        <SidebarHeader className="pb-0">
          <SidebarMenu className="gap-0.5">
            <SidebarScopeCombobox />
            <SidebarThreadSearch />
          </SidebarMenu>
        </SidebarHeader>
        {/*
          Icon-collapsed: hide list content but keep its flex space so the footer
          stays at the bottom (`hidden` would drop that space). Delay visibility
          until the width transition finishes (duration-200 on the sidebar shell).
          Reset group-label margin — SidebarGroupLabel applies -mt-8 in icon mode,
          which pulls text into the header and overflows the narrow rail when content
          still lays out.
        */}
        <SidebarContent className="group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:transition-[visibility] group-data-[collapsible=icon]:delay-200 group-data-[collapsible=icon]:duration-0 group-data-[collapsible=icon]:**:data-[sidebar=group-label]:mt-0">
          <SidebarThreadList />
        </SidebarContent>
        <SidebarFooterSection user={user} />
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="flex h-10 shrink-0 items-center gap-2 px-3 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
