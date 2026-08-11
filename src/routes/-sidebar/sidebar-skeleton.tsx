import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_WIDTHS = ["w-3/5", "w-2/3", "w-4/5", "w-1/2"] as const;

const getSkeletonWidthClass = (seed: number): string =>
  SKELETON_WIDTHS[seed % SKELETON_WIDTHS.length] ?? SKELETON_WIDTHS[0];

type SidebarThreadsSkeletonProps = {
  count: number;
};

export const SidebarThreadsSkeleton = ({ count }: SidebarThreadsSkeletonProps) =>
  Array.from({ length: count }, (_, index) => (
    <SidebarMenuItem key={index}>
      <SidebarMenuButton aria-hidden="true" className="pointer-events-none" disabled tabIndex={-1}>
        <Skeleton className={cn("h-4 flex-1", getSkeletonWidthClass(index))} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
