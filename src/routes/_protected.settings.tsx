import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { T, useGT, useLocale } from "gt-tanstack-start";
import { AlertCircleIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authClient } from "@/lib/better-auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import type { GT } from "@/lib/gt";
import { authKeys } from "@/routes/_auth/-auth.api";
import { sessionsQuery } from "@/routes/_protected.settings/-sessions-api";
import type { SessionItem } from "@/routes/_protected.settings/-sessions-api";

export const Route = createFileRoute("/_protected/settings")({
  component: RouteComponent,
});

const MOBILE_PATTERN = /android|iphone|ipad|ipod|mobile/i;

const BROWSER_PATTERNS = [
  { label: "Edge", pattern: /edg(?:e|a|ios)?\//i },
  { label: "Opera", pattern: /opr\/|opera/i },
  { label: "Firefox", pattern: /firefox\/|fxios\//i },
  { label: "Chrome", pattern: /chrome\/|crios\//i },
  { label: "Safari", pattern: /safari\//i },
] as const;

const OS_PATTERNS = [
  { label: "Windows", pattern: /windows nt/i },
  { label: "Android", pattern: /android/i },
  { label: "iOS", pattern: /iphone|ipad|ipod/i },
  { label: "macOS", pattern: /mac os x/i },
  { label: "Linux", pattern: /linux/i },
] as const;

const describeUserAgent = (gt: GT, userAgent: string | null | undefined) => {
  if (!userAgent) {
    return gt("Unknown device");
  }

  const browser = BROWSER_PATTERNS.find(({ pattern }) => pattern.test(userAgent))?.label;
  const os = OS_PATTERNS.find(({ pattern }) => pattern.test(userAgent))?.label;

  if (browser && os) {
    return `${browser} · ${os}`;
  }

  return browser ?? os ?? gt("Unknown device");
};

const formatSessionDate = (locale: string, date: Date) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);

function RouteComponent() {
  const gt = useGT();
  const navigate = useNavigate();
  const currentSessionId = Route.useRouteContext({ select: (context) => context.session.id });
  const sessions = useQuery(sessionsQuery);

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeSessions();

      if (error) {
        throw toAuthError(error);
      }
    },
    onError: () => {
      toast.error(gt("Could not revoke sessions"));
    },
    // Revoking every session includes this one, so clear the session cookie and
    // Better Auth's client store before leaving the protected layout.
    onSuccess: async () => {
      await authClient.signOut();
      await navigate({ to: "/sign-in" });
    },
  });

  const columns = [
    gt("Device"),
    gt("IP address"),
    gt("Last active"),
    gt("Signed in"),
    null,
  ] as const;

  const items = sessions.data ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 md:gap-6 md:p-6">
      <h1 className="text-lg font-semibold">
        <T>Settings</T>
      </h1>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">
            <T>Active sessions</T>
          </h2>
          <Button
            disabled={revokeAllMutation.isPending}
            onClick={() => {
              revokeAllMutation.mutate();
            }}
            variant="outline"
          >
            <T>Revoke all</T>
          </Button>
        </div>
        <Frame className="w-full">
          <Table className="w-full" variant="card">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column, index) =>
                  column ? (
                    <TableHead key={column}>{column}</TableHead>
                  ) : (
                    <TableHead key={`column-${index}`} aria-hidden="true" className="w-10" />
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="in-data-[variant=card]:*:[tr]:hover:*:[td]:bg-card!">
              {sessions.isLoading &&
                Array.from({ length: 3 }, (_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: columns.length }, (__, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {sessions.isError && (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <AlertCircleIcon className="text-destructive" />
                        </EmptyMedia>
                        <EmptyTitle className="text-destructive">
                          <T>Could not load sessions</T>
                        </EmptyTitle>
                        <EmptyDescription>
                          <T>Check your connection and try again.</T>
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button
                          onClick={async () => {
                            await sessions.refetch();
                          }}
                          variant="outline"
                        >
                          <T>Try again</T>
                        </Button>
                      </EmptyContent>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
              {sessions.isSuccess &&
                items.map((item) => (
                  <SessionRow
                    isCurrent={item.id === currentSessionId}
                    key={item.id}
                    session={item}
                  />
                ))}
            </TableBody>
          </Table>
        </Frame>
      </div>
    </div>
  );
}

type SessionRowProps = {
  isCurrent: boolean;
  session: SessionItem;
};

const SessionRow = ({ isCurrent, session }: SessionRowProps) => {
  const gt = useGT();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const revokeSession = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeSession({ token: session.token });

      if (error) {
        throw toAuthError(error);
      }
    },
    onError: () => {
      toast.error(gt("Could not revoke session"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.sessions() });
    },
  });

  const isMobile = MOBILE_PATTERN.test(session.userAgent ?? "");

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-0 items-center gap-2">
          {isMobile ? (
            <SmartphoneIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <MonitorIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate font-medium">{describeUserAgent(gt, session.userAgent)}</span>
          {isCurrent && (
            <Badge variant="outline">
              <T>This device</T>
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{session.ipAddress ?? gt("Unknown")}</TableCell>
      <TableCell>{formatSessionDate(locale, session.updatedAt)}</TableCell>
      <TableCell>{formatSessionDate(locale, session.createdAt)}</TableCell>
      <TableCell className="text-right">
        <Button
          disabled={isCurrent || revokeSession.isPending}
          onClick={() => {
            revokeSession.mutate();
          }}
          size="sm"
          variant="ghost"
        >
          <T>Revoke</T>
        </Button>
      </TableCell>
    </TableRow>
  );
};
