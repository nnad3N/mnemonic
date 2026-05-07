import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router";

import { Frame, FrameHeader, FramePanel } from "@/components/ui/frame";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";
import { Route as SignInRoute } from "@/routes/_auth/sign-in";
import { Route as SignUpRoute } from "@/routes/_auth/sign-up";

export const Route = createFileRoute("/_auth")({ component: LayoutComponent });

/* oxlint-disable func-style */
function LayoutComponent() {
  const pathname = useLocation({ select: (s) => s.pathname });

  return (
    <Frame className="w-full max-w-md">
      <FrameHeader className="p-1">
        <Tabs value={pathname}>
          <TabsList className="w-full">
            <TabsTab
              nativeButton={false}
              render={<Link to={SignInRoute.fullPath} />}
              value={SignInRoute.fullPath}
            >
              {m.auth_sign_in()}
            </TabsTab>
            <TabsTab
              nativeButton={false}
              render={<Link to={SignUpRoute.fullPath} />}
              value={SignUpRoute.fullPath}
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
