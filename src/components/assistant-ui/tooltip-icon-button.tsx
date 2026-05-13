"use client";

import type { ComponentPropsWithRef, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export function TooltipIconButton({
  children,
  tooltip,
  side = "bottom",
  className,
  ref,
  ...rest
}: TooltipIconButtonProps): ReactElement {
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className={cn("aui-button-icon size-6 p-1", className)}
              ref={ref}
              size="icon"
              variant="ghost"
              {...rest}
            />
          }
        >
          {children}
          <span className="aui-sr-only sr-only">{tooltip}</span>
        </TooltipTrigger>
        <TooltipContent side={side}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
