import { useRender } from "@base-ui/react/use-render";
import { useGT } from "gt-tanstack-start";
import { ChevronsDownUpIcon } from "lucide-react";
import type { ComponentProps, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { SidebarMenuButton, SidebarMenuSubButton } from "@/components/ui/sidebar";

type SidebarMenuButtonType = typeof SidebarMenuButton | typeof SidebarMenuSubButton;

type SidebarMoreRender = ReactElement<ComponentProps<SidebarMenuButtonType>, SidebarMenuButtonType>;

type SidebarMoreProps = {
  render: SidebarMoreRender;
  disabled: boolean;
  onCollapse: () => void;
  onMore: () => void | Promise<void>;
  showCollapse: boolean;
};

export const SidebarMore = ({
  render,
  disabled,
  onCollapse,
  onMore,
  showCollapse,
}: SidebarMoreProps) => {
  const gt = useGT();
  const button = useRender({
    render,
    props: {
      className: "text-muted-foreground hover:text-muted-foreground",
      disabled,
      onClick: onMore,
      children: gt("More"),
    },
  });

  return (
    <div className="group/more flex">
      {button}
      {showCollapse && (
        <Button
          className="text-sidebar-foreground opacity-0 group-hover/more:opacity-100"
          onClick={onCollapse}
          size="icon-sm"

          variant="ghost"
        >
          <ChevronsDownUpIcon />
        </Button>
      )}
    </div>
  );
};
