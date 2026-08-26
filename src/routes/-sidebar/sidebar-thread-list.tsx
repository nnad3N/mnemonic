import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { T, useLocale } from "gt-tanstack-start";
import { CircleIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { matchesQuery } from "@/lib/string-match";
import { cn } from "@/lib/utils";
import type { SidebarThread } from "@/routes/-sidebar/sidebar.functions";
import { sidebarQueries } from "@/routes/-sidebar/sidebar.functions";
import type { SidebarSearch } from "@/routes/_protected";
import { threadRunQueries } from "@/routes/_protected.chat.$threadId/-thread-api/thread-run.functions";
import type { ThreadRunState } from "@/routes/_protected.chat.$threadId/-thread-api/thread-run.server";
import { ThreadContextMenu } from "@/routes/_protected.chat.$threadId/-thread-components/thread-actions";

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

  // oxlint-disable-next-line anti-slop/no-runtime-typeof
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
  const { q, range, topic } = useSearch({
    from: "/_protected",
    select: (search) => ({ q: search.q, range: search.range, topic: search.topic }),
  });
  const threads = useQuery(sidebarQueries.threads(topic));
  const runStates = useQuery({
    ...threadRunQueries.states(),
    select: (states) => new Map(states.map((state) => [state.threadId, state])),
  }).data;
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
                <SidebarThreadItem runState={runStates?.get(thread.id)} thread={thread} />
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
  runState: ThreadRunState | undefined;
  thread: SidebarThread;
};

const SidebarThreadItem = ({ runState, thread }: SidebarThreadItemProps) => {
  const locale = useLocale();

  return (
    <ThreadContextMenu
      render={(isActive) => <SidebarMenuButton isActive={isActive} />}
      threadId={thread.id}
      title={thread.title}
    >
      {(isActive) => (
        <>
          <span
            className={cn("min-w-0 flex-1 truncate", runState?.status === "running" && "shimmer")}
          >
            {thread.title}
          </span>
          <ThreadTrailing
            isActive={isActive}
            locale={locale}
            runState={runState}
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
  isActive: boolean;
  locale: string;
  runState: ThreadRunState | undefined;
  updatedAt: string;
};

const ThreadTrailing = ({ isActive, locale, runState, updatedAt }: ThreadTrailingProps) => {
  const unseen = !isActive && runState && runState.status !== "running";

  if (unseen && runState.status === "finished") {
    return <CircleIcon className="size-1.5 shrink-0 text-f-blue" />;
  }

  if (unseen) {
    return <CircleIcon className="size-1.5 shrink-0 text-f-red" />;
  }

  return (
    <span className="shrink-0 text-xs text-sidebar-foreground/50">
      {formatLastActive(locale, updatedAt)}
    </span>
  );
};
