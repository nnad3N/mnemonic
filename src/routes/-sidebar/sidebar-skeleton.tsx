import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_WIDTHS = ["w-3/5", "w-2/3", "w-4/5", "w-1/2"] as const;

const getSkeletonWidthClass = (seed: number): string =>
  SKELETON_WIDTHS[seed % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0];

type SidebarMenuButtonSkeletonProps = {
  seed: number;
  showIcon?: boolean;
};

const SidebarMenuButtonSkeleton = ({
  seed,
  showIcon = false,
}: SidebarMenuButtonSkeletonProps) => (
  <SidebarMenuButton
    aria-hidden="true"
    className="pointer-events-none"
    disabled
    tabIndex={-1}
  >
    {showIcon ? <Skeleton className="size-4 shrink-0 rounded-sm" /> : null}
    <Skeleton className={cn("h-4 flex-1", getSkeletonWidthClass(seed))} />
  </SidebarMenuButton>
);

type SidebarMenuSubButtonSkeletonProps = {
  seed: number;
};

const SidebarMenuSubButtonSkeleton = ({
  seed,
}: SidebarMenuSubButtonSkeletonProps) => (
  <SidebarMenuSubButton
    aria-disabled="true"
    aria-hidden="true"
    className="pointer-events-none w-full"
    render={<button className="w-full" disabled type="button" />}
    tabIndex={-1}
  >
    <Skeleton className={cn("h-4 flex-1", getSkeletonWidthClass(seed))} />
  </SidebarMenuSubButton>
);

type SidebarConversationsSkeletonProps = {
  count: number;
};

export const SidebarConversationsSkeleton = ({
  count,
}: SidebarConversationsSkeletonProps) =>
  Array.from({ length: count }, (_, index) => (
    <SidebarMenuItem key={index}>
      <SidebarMenuButtonSkeleton seed={index} />
    </SidebarMenuItem>
  ));

type SidebarTopicsSkeletonProps = {
  count: number;
};

export const SidebarTopicsSkeleton = ({ count }: SidebarTopicsSkeletonProps) =>
  Array.from({ length: count }, (_, index) => (
    <SidebarMenuItem key={index}>
      <SidebarMenuButtonSkeleton seed={index} showIcon />
      <SidebarMenuSub>
        {Array.from({ length: 2 }, (__, threadIndex) => (
          <SidebarMenuSubItem key={threadIndex}>
            <SidebarMenuSubButtonSkeleton seed={index * 2 + threadIndex} />
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    </SidebarMenuItem>
  ));
