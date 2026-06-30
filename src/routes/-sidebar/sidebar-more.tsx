import { useRender } from "@base-ui/react/use-render";
import { ChevronsDownUpIcon } from "lucide-react";
import type { ComponentProps, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  SidebarMenuButton,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { m } from "@/paraglide/messages";

type SidebarMenuButtonType =
  | typeof SidebarMenuButton
  | typeof SidebarMenuSubButton;

type SidebarMoreRender = ReactElement<
  ComponentProps<SidebarMenuButtonType>,
  SidebarMenuButtonType
>;

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
  const button = useRender({
    render,
    props: {
      className: "text-muted-foreground hover:text-muted-foreground",
      disabled,
      onClick: onMore,
      children: m.common_more(),
    },
  });

  return (
    <div className="group/more flex">
      {button}
      {showCollapse && (
        <Button
          aria-label={m.common_collapse()}
          className="text-sidebar-foreground opacity-0 group-hover/more:opacity-100"
          onClick={onCollapse}
          size="icon-sm"
          title={m.common_collapse()}
          variant="ghost"
        >
          <ChevronsDownUpIcon />
        </Button>
      )}
    </div>
  );
};
