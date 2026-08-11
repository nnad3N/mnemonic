import { Outlet, createFileRoute, redirect, retainSearchParams } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import * as v from "valibot";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  SIDEBAR_COOKIE_NAME,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

import { AppHeader } from "./-app-header";
import { SidebarFooterSection } from "./-sidebar/sidebar-menu";
import { SidebarScopeCombobox } from "./-sidebar/sidebar-scope-combobox";
import { SidebarThreadList } from "./-sidebar/sidebar-thread-list";
import { SidebarThreadSearch } from "./-sidebar/sidebar-thread-search";

const SIDEBAR_DEFAULT_SIZE = "16rem";
const SIDEBAR_MIN_SIZE = "13rem";
const SIDEBAR_MAX_SIZE = "28rem";
const SIDEBAR_WIDTH_COOKIE_NAME = "sidebar_width";
const SIDEBAR_WIDTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const sidebarWidthSchema = v.pipe(v.string(), v.regex(/^\d+(\.\d+)?(px|rem)$/));

const getSidebarLayout = createServerFn({ method: "GET" }).handler(() => {
  const widthParsed = v.safeParse(sidebarWidthSchema, getCookie(SIDEBAR_WIDTH_COOKIE_NAME));

  return {
    sidebarOpen: getCookie(SIDEBAR_COOKIE_NAME) !== "false",
    sidebarWidth: widthParsed.success ? widthParsed.output : SIDEBAR_DEFAULT_SIZE,
  };
});

const setSidebarWidthCookie = (sidebarWidth: string) => {
  document.cookie = `${SIDEBAR_WIDTH_COOKIE_NAME}=${sidebarWidth}; path=/; max-age=${SIDEBAR_WIDTH_COOKIE_MAX_AGE}`;
};

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
  loader: async () => getSidebarLayout(),
  search: { middlewares: [retainSearchParams(["topic", "q", "range"])] },
  validateSearch: sidebarSearchSchema,
});

function LayoutComponent() {
  const { sidebarOpen, sidebarWidth } = Route.useLoaderData();

  return (
    <SidebarProvider className="h-full min-h-0" defaultOpen={sidebarOpen}>
      <ProtectedLayout sidebarWidth={sidebarWidth} />
    </SidebarProvider>
  );
}

type ProtectedLayoutProps = {
  sidebarWidth: string;
};

const ProtectedLayout = ({ sidebarWidth }: ProtectedLayoutProps) => {
  const isMobile = useIsMobile();
  const { open } = useSidebar();

  return (
    <>
      {isMobile && (
        <Sidebar>
          <SidebarBody />
        </Sidebar>
      )}
      <ResizablePanelGroup orientation="horizontal">
        {!isMobile && open && (
          <>
            <ResizablePanel
              defaultSize={sidebarWidth}
              groupResizeBehavior="preserve-pixel-size"
              id="sidebar"
              maxSize={SIDEBAR_MAX_SIZE}
              minSize={SIDEBAR_MIN_SIZE}
              onResize={(panelSize, _id, prevPanelSize) => {
                if (!prevPanelSize) return;
                setSidebarWidthCookie(`${Math.round(panelSize.inPixels)}px`);
              }}
              style={{ overflow: "hidden" }}
            >
              <Sidebar>
                <SidebarBody />
              </Sidebar>
            </ResizablePanel>
            <ResizableHandle />
          </>
        )}
        <ResizablePanel minSize="20rem">
          <SidebarInset className="h-full min-h-0 overflow-hidden">
            <AppHeader />
            <div className="h-full min-h-0 overflow-hidden">
              <Outlet />
            </div>
          </SidebarInset>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
};

const SidebarBody = () => {
  const user = Route.useRouteContext({ select: (context) => context.user });

  return (
    <>
      <SidebarHeader className="pb-0">
        <SidebarMenu className="gap-0.5">
          <SidebarScopeCombobox />
          <SidebarThreadSearch />
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarThreadList />
      </SidebarContent>
      <SidebarFooterSection user={user} />
    </>
  );
};
