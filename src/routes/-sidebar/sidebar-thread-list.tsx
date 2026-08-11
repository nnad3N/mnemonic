import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { T, useLocale } from "gt-tanstack-start";
import { AlertCircleIcon, CircleIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { matchesQuery } from "@/lib/string-match";
import { cn } from "@/lib/utils";
import type { SidebarSearch } from "@/routes/_protected";
import type { SidebarThread } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import { sidebarThreadsQuery } from "@/routes/_protected.chat.$threadId/-thread-api/sidebar-data";
import { ThreadContextMenu } from "@/routes/_protected.chat.$threadId/-thread-components/thread-actions";

import type { ThreadIndicator } from "../-chat-store";
import { useChatStore } from "../-chat-store";
import { SidebarGroupEmpty } from "./sidebar-empty";
import { SidebarThreadsSkeleton } from "./sidebar-skeleton";

const PRESET_DAYS = {
  "7d": 7,
  "30d": 30,
} as const;

/** Inclusive instant bounds for a range, or null when no range is selected. */
const resolveDateRange = (range: SidebarSearch["range"]) => {
  if (range === undefined) return null;

  const timeZone = Temporal.Now.timeZoneId();
  const today = Temporal.Now.plainDateISO(timeZone);

  if (typeof range === "string") {
    const startDate = range === "today" ? today : today.subtract({ days: PRESET_DAYS[range] - 1 });

    return {
      from: startDate.toZonedDateTime({ timeZone }).toInstant(),
      to: today.add({ days: 1 }).toZonedDateTime({ timeZone }).toInstant(),
    };
  }

  return {
    from: Temporal.PlainDate.from(range.from).toZonedDateTime({ timeZone }).toInstant(),
    to: Temporal.PlainDate.from(range.to)
      .add({ days: 1 })
      .toZonedDateTime({ timeZone })
      .toInstant(),
  };
};

type InstantRange = NonNullable<ReturnType<typeof resolveDateRange>>;

const isWithinRange = (updatedAt: string, bounds: InstantRange | null) => {
  if (!bounds) return true;

  const instant = Temporal.Instant.from(updatedAt);

  return (
    Temporal.Instant.compare(instant, bounds.from) >= 0 &&
    Temporal.Instant.compare(instant, bounds.to) < 0
  );
};

export const SidebarThreadList = () => {
  const { q, range, topic } = useSearch({ from: "/_protected" });
  const threads = useQuery(sidebarThreadsQuery(topic));
  const bounds = resolveDateRange(range);
  const visibleThreads = (threads.data ?? []).filter(
    (thread) => matchesQuery(thread.title, q) && isWithinRange(thread.updatedAt, bounds),
  );

  return (
    <SidebarGroup className="pt-0.5">
      <SidebarGroupContent>
        <SidebarMenu>
          {threads.isSuccess ? (
            visibleThreads.map((thread) => (
              <SidebarMenuItem key={thread.id}>
                <SidebarThreadItem thread={thread} />
              </SidebarMenuItem>
            ))
          ) : (
            <SidebarThreadsSkeleton count={6} />
          )}
          {threads.isSuccess && visibleThreads.length === 0 && (
            <SidebarGroupEmpty className="pt-2">
              {threads.data.length === 0 ? <T>No threads yet</T> : <T>No threads match</T>}
            </SidebarGroupEmpty>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

type SidebarThreadItemProps = {
  thread: SidebarThread;
};

const SidebarThreadItem = ({ thread }: SidebarThreadItemProps) => {
  const locale = useLocale();
  const indicator = useChatStore((state) => state.threadIndicators.get(thread.id));

  return (
    <ThreadContextMenu
      render={(isActive) => <SidebarMenuButton isActive={isActive} />}
      threadId={thread.id}
      title={thread.title}
    >
      {(isActive) => (
        <>
          <span className={cn("min-w-0 flex-1 truncate", indicator === "pending" && "shimmer")}>
            {thread.title}
          </span>
          <ThreadTrailing
            indicator={indicator}
            isActive={isActive}
            locale={locale}
            updatedAt={thread.updatedAt}
          />
        </>
      )}
    </ThreadContextMenu>
  );
};

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;

const formatLastActive = (locale: string, updatedAt: string) => {
  const elapsed = Temporal.Now.instant()
    .since(Temporal.Instant.from(updatedAt))
    .total({ unit: "second" });

  if (elapsed >= WEEK_SECONDS) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(Temporal.Instant.from(updatedAt));
  }

  // DurationFormat omits past phrasing ("ago"); RelativeTimeFormat only for "now".
  if (elapsed < MINUTE_SECONDS) {
    return new Intl.RelativeTimeFormat(locale, {
      numeric: "auto",
      style: "narrow",
    }).format(0, "second");
  }

  const duration = new Intl.DurationFormat(locale, { style: "narrow" });

  if (elapsed < HOUR_SECONDS) {
    return duration.format({ minutes: Math.floor(elapsed / MINUTE_SECONDS) });
  }
  if (elapsed < DAY_SECONDS) {
    return duration.format({ hours: Math.floor(elapsed / HOUR_SECONDS) });
  }

  return duration.format({ days: Math.floor(elapsed / DAY_SECONDS) });
};

type ThreadTrailingProps = {
  indicator: ThreadIndicator | undefined;
  isActive: boolean;
  locale: string;
  updatedAt: string;
};

const ThreadTrailing = ({ indicator, isActive, locale, updatedAt }: ThreadTrailingProps) => {
  if (!isActive && indicator === "ready") {
    return <CircleIcon className="size-1.5 shrink-0 text-f-blue" />;
  }

  if (!isActive && indicator === "error") {
    return <AlertCircleIcon className="size-1.5 shrink-0 text-f-red" />;
  }

  return (
    <span className="shrink-0 text-xs text-sidebar-foreground/50">
      {formatLastActive(locale, updatedAt)}
    </span>
  );
};
