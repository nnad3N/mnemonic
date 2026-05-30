import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from "@tanstack/react-router";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";
import { Route as SignInRoute } from "@/routes/_auth/sign-in";
import { Route as SignUpRoute } from "@/routes/_auth/sign-up";

export const Route = createFileRoute("/_auth")({ component: LayoutComponent });

/* oxlint-disable func-style */
function LayoutComponent() {
  const pathname = useLocation({ select: (s) => s.pathname });

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Tabs value={pathname}>
            <TabsList className="w-full">
              <TabsTrigger
                nativeButton={false}
                render={<Link to={SignInRoute.fullPath} />}
                value={SignInRoute.fullPath}
              >
                {m.auth_sign_in()}
              </TabsTrigger>
              <TabsTrigger
                nativeButton={false}
                render={<Link to={SignUpRoute.fullPath} />}
                value={SignUpRoute.fullPath}
              >
                {m.auth_sign_up()}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <Outlet />
        </CardContent>
      </Card>
    </div>
  );
}
