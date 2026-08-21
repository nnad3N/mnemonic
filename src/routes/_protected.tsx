import {
  Outlet,
  createFileRoute,
  redirect,
  retainSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { produce } from "immer";
import { usePanelRef } from "react-resizable-panels";
import * as v from "valibot";

import { NotesPanel } from "@/components/notes-editor/notes-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-media-query";
import * as Kit from "@/lib/kit";
import {
  MAIN_PANEL_MIN_SIZE,
  NOTES_PANEL_FALLBACK_SIZE,
  NOTES_PANEL_WIDTH_COOKIE_NAME,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_DEFAULT_SIZE,
  SIDEBAR_MAX_SIZE,
  SIDEBAR_MIN_SIZE,
  SIDEBAR_WIDTH_COOKIE_MAX_AGE,
  SIDEBAR_WIDTH_COOKIE_NAME,
} from "@/lib/layout-consts";
import { useSyncRunStates } from "@/routes/_protected.chat.$threadId/-hooks/use-sync-run-states";
import { byokQueries } from "@/routes/_protected.settings/-byok.functions";

import { AppHeader } from "./-app-header";
import { SidebarFooterSection } from "./-sidebar/sidebar-menu";
import { SidebarScopeCombobox } from "./-sidebar/sidebar-scope-combobox";
import { SidebarThreadList } from "./-sidebar/sidebar-thread-list";
import { SidebarThreadSearch } from "./-sidebar/sidebar-thread-search";

const sidebarWidthSchema = v.pipe(v.string(), v.regex(/^\d+px$/));

const readCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name))
  .client((name: string) => Kit.cookies.get(name).unwrapOr(undefined));

const sidebarSearchSchema = v.object({
  note: v.optional(v.pipe(v.string(), v.nanoid())),
  noteTabs: v.optional(v.array(v.pipe(v.string(), v.nanoid())), []),
  notes: v.optional(v.boolean()),
  topic: v.optional(v.pipe(v.string(), v.nanoid())),
  q: v.optional(v.string(), ""),
  range: v.optional(
    v.union([v.picklist(["today", "7d", "30d"]), v.object({ from: v.string(), to: v.string() })]),
  ),
});

export type SidebarSearch = v.InferInput<typeof sidebarSearchSchema>;

export const Route = createFileRoute("/_protected")({
  search: {
    middlewares: [retainSearchParams(["note", "noteTabs", "notes", "topic", "q", "range"])],
  },
  validateSearch: sidebarSearchSchema,
  beforeLoad: async ({ context, location }) => {
    if (!context.user || !context.session) {
      throw redirect({ to: "/sign-in" });
    }

    const byoks = await context.queryClient.ensureQueryData({
      ...byokQueries.mine(),
      revalidateIfStale: true,
    });

    if (byoks.length === 0 && location.pathname !== "/") {
      throw redirect({ to: "/" });
    }

    return { session: context.session, user: context.user };
  },
  loader: () => {
    const widthParsed = v.safeParse(sidebarWidthSchema, readCookie(SIDEBAR_WIDTH_COOKIE_NAME));
    const notesWidthParsed = v.safeParse(
      sidebarWidthSchema,
      readCookie(NOTES_PANEL_WIDTH_COOKIE_NAME),
    );

    return {
      notesWidth: notesWidthParsed.success ? notesWidthParsed.output : undefined,
      sidebarOpen: readCookie(SIDEBAR_COOKIE_NAME) !== "false",
      sidebarWidth: widthParsed.success ? widthParsed.output : SIDEBAR_DEFAULT_SIZE,
    };
  },
  component: LayoutComponent,
});

function LayoutComponent() {
  useSyncRunStates();
  const { notesWidth, sidebarOpen, sidebarWidth } = Route.useLoaderData();

  return (
    <SidebarProvider className="h-full min-h-0" defaultOpen={sidebarOpen}>
      <ProtectedLayout notesWidth={notesWidth} sidebarWidth={sidebarWidth} />
    </SidebarProvider>
  );
}

type ProtectedLayoutProps = {
  notesWidth: string | undefined;
  sidebarWidth: string;
};

const ProtectedLayout = ({ notesWidth, sidebarWidth }: ProtectedLayoutProps) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const notesOpen = Route.useSearch({ select: (search) => search.notes === true });
  const { open } = useSidebar();
  const sidebarPanelRef = usePanelRef();
  const mainPanelRef = usePanelRef();

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
              // Cookie width for SSR; double-click resets to SIDEBAR_DEFAULT_SIZE via the handle.
              defaultSize={sidebarWidth}
              groupResizeBehavior="preserve-pixel-size"
              id="sidebar"
              maxSize={SIDEBAR_MAX_SIZE}
              minSize={SIDEBAR_MIN_SIZE}
              onResize={(panelSize, _id, prevPanelSize) => {
                if (!prevPanelSize) return;
                Kit.cookies.set({
                  name: SIDEBAR_WIDTH_COOKIE_NAME,
                  value: `${Math.round(panelSize.inPixels)}px`,
                  options: { maxAge: SIDEBAR_WIDTH_COOKIE_MAX_AGE },
                });
              }}
              panelRef={sidebarPanelRef}
              style={{ overflow: "hidden" }}
            >
              <Sidebar>
                <SidebarBody />
              </Sidebar>
            </ResizablePanel>
            <ResizableHandle
              disableDoubleClick
              onDoubleClick={() => {
                sidebarPanelRef.current?.resize(SIDEBAR_DEFAULT_SIZE);
              }}
            />
          </>
        )}
        <ResizablePanel minSize={MAIN_PANEL_MIN_SIZE} panelRef={mainPanelRef}>
          <SidebarInset className="h-full min-h-0 overflow-hidden">
            <AppHeader />
            <div className="h-full min-h-0 overflow-hidden">
              <Outlet />
            </div>
          </SidebarInset>
        </ResizablePanel>
        {notesOpen && (
          <NotesPanel
            minSize={MAIN_PANEL_MIN_SIZE}
            onClose={async () =>
              navigate({
                search: (prev) =>
                  produce(prev, (draft) => {
                    draft.notes = undefined;
                  }),
                to: ".",
              })
            }
            threadPanelRef={mainPanelRef}
            width={notesWidth ?? NOTES_PANEL_FALLBACK_SIZE}
          />
        )}
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
