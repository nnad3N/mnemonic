import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/lib/utils";
import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";

export type ToolIndicatorProps = useRender.ComponentProps<"div"> & {
  enabled?: boolean;
  interactive?: boolean;
  pending?: boolean;
};

export const ToolIndicator = ({
  className,
  render,
  enabled,
  interactive = false,
  pending = false,
  ...props
}: ToolIndicatorProps) => {
  const { isAnimating } = useMessageState();

  return useRender({
    enabled,
    defaultTagName: interactive ? "button" : "div",
    props: mergeProps(
      {
        className: cn(
          "flex w-max items-center gap-0.5 text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          pending && isAnimating
            ? "shimmer"
            : interactive
              ? "group/tool transition-colors hover:text-foreground"
              : "",
          className,
        ),
      },
      props,
    ),
    render,
  });
};
