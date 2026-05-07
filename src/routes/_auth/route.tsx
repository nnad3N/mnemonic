import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";

import { Frame, FrameHeader, FramePanel } from "@/components/ui/frame";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";

export const Route = createFileRoute("/_auth")({ component: LayoutComponent });

/* oxlint-disable func-style */
function LayoutComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Frame className="w-full max-w-md">
      <FrameHeader className="p-1">
        <Tabs value={pathname}>
          <TabsList className="w-full">
            <TabsTab
              nativeButton={false}
              render={<Link to="/sign-in" />}
              value="/sign-in"
            >
              {m.auth_sign_in()}
            </TabsTab>
            <TabsTab
              nativeButton={false}
              render={<Link to="/sign-up" />}
              value="/sign-up"
            >
              {m.auth_sign_up()}
            </TabsTab>
          </TabsList>
        </Tabs>
      </FrameHeader>
      <FramePanel>
        <Outlet />
      </FramePanel>
    </Frame>
  );
}
