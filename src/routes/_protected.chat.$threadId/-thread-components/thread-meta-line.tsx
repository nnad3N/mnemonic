import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type ThreadMetaLineProps = {
  className?: string;
};

export const ThreadMetaLine = ({
  className,
  children,
}: PropsWithChildren<ThreadMetaLineProps>) => (
  <div
    className={cn(
      "flex w-full items-center gap-1.5 text-base text-muted-foreground md:text-sm",
      className
    )}
  >
    {children}
  </div>
);
