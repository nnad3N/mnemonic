import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { T, useGT, useLocale } from "gt-tanstack-start";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableErrorRow,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from "@/components/ui/table";
import { authClient } from "@/lib/better-auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import type { GT } from "@/lib/gt";
import { authKeys } from "@/routes/_auth/-auth.api";
import { sessionsQuery } from "@/routes/_protected.settings/-sessions-api";
import type { SessionItem } from "@/routes/_protected.settings/-sessions-api";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionTitle,
} from "@/routes/_protected.settings/-settings-section";

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
  }).format(new Date(date));

type SessionsSectionProps = {
  currentSessionId: string;
};

export const SessionsSection = ({ currentSessionId }: SessionsSectionProps) => {
  const gt = useGT();
  const navigate = useNavigate();
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

  const items = sessions.data ?? [];

  return (
    <SettingsSection>
      <SettingsSectionHeader>
        <SettingsSectionTitle>
          <T>Active sessions</T>
        </SettingsSectionTitle>
        <Button
          disabled={revokeAllMutation.isPending}
          onClick={() => {
            revokeAllMutation.mutate();
          }}
          variant="outline"
        >
          <T>Revoke all</T>
        </Button>
      </SettingsSectionHeader>
      <Frame className="w-full">
        <Table className="w-full" variant="card">
          <TableHeader>
            <TableRow hoverable={false}>
              <TableHead>{gt("Device")}</TableHead>
              <TableHead>{gt("IP address")}</TableHead>
              <TableHead>{gt("Last active")}</TableHead>
              <TableHead>{gt("Signed in")}</TableHead>
              <TableHead aria-hidden="true" className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody hoverable={false}>
            {sessions.isLoading && (
              <TableSkeletonRows widths={["w-48", "w-20", "w-40", "w-40", "ml-auto w-14"]} />
            )}
            {sessions.isError && (
              <TableErrorRow colSpan={5} onRetry={sessions.refetch}>
                <T>Could not load sessions</T>
              </TableErrorRow>
            )}
            {items.map((item) => (
              <SessionRow isCurrent={item.id === currentSessionId} key={item.id} session={item} />
            ))}
          </TableBody>
        </Table>
      </Frame>
    </SettingsSection>
  );
};

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
