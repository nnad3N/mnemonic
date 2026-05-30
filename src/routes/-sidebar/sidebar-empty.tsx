import type * as React from "react";

import { cn } from "@/lib/utils";

type SidebarGroupEmptyProps = {
  children: React.ReactNode;
  className?: string;
};

export const SidebarGroupEmpty = ({
  children,
  className,
}: SidebarGroupEmptyProps) => (
  <p
    className={cn(
      "px-3 text-xs text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden",
      className
    )}
  >
    {children}
  </p>
);
