import type * as React from "react";

import { cn } from "@/lib/utils";

type PageContentProps = React.ComponentProps<"div">;

export const PageContent = ({ className, ...props }: PageContentProps) => (
  <div
    className={cn("flex h-full min-h-0 flex-col overflow-auto px-3 pt-14 pb-3 md:pt-12", className)}
    data-slot="page-content"
    {...props}
  />
);
