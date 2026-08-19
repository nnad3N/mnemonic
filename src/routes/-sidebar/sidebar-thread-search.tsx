import { useNavigate, useSearch } from "@tanstack/react-router";
import { T, useGT } from "gt-tanstack-start";
import { produce } from "immer";
import { ListFilterIcon, SearchIcon, XIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { SidebarSearch } from "@/routes/_protected";

const today = () => Temporal.Now.plainDateISO().toString();

type RangePreset = "today" | "7d" | "30d" | "custom";

export const SidebarThreadSearch = () => {
  const gt = useGT();
  const navigate = useNavigate();
  const { q, range } = useSearch({
    from: "/_protected",
    select: (search) => ({ q: search.q, range: search.range }),
  });

  const setSearch = async (update: (draft: SidebarSearch) => void) =>
    navigate({
      replace: true,
      search: (prev) => produce(prev, update),
      to: ".",
    });

  const customRange = typeof range === "object" ? range : undefined;
  const rangeValue = typeof range === "string" ? range : customRange ? "custom" : "all";

  const toggleRange = async (preset: RangePreset, checked: boolean) => {
    await setSearch((draft) => {
      if (!checked) {
        draft.range = undefined;
        return;
      }

      draft.range = preset === "custom" ? { from: today(), to: today() } : preset;
    });
  };

  return (
    <SidebarMenuItem className="flex items-center gap-1">
      <InputGroup className="bg-transparent">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          onChange={async (event) => {
            await setSearch((draft) => {
              draft.q = event.target.value;
            });
          }}
          placeholder={gt("Search threads…")}
          value={q}
        />
        {q.length > 0 && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              onClick={async () => {
                await setSearch((draft) => {
                  draft.q = "";
                });
              }}
              size="icon-xs"
              variant="ghost"
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<InputGroupButton size="icon-sm" variant="ghost" />}
          className="relative"
        >
          <ListFilterIcon className={cn(range !== undefined && "text-f-blue")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuCheckboxItem
            checked={rangeValue === "all"}
            onCheckedChange={async () => {
              await setSearch((draft) => {
                draft.range = undefined;
              });
            }}
          >
            <T>All time</T>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={rangeValue === "today"}
            onCheckedChange={async (checked) => {
              await toggleRange("today", checked);
            }}
          >
            <T>Today</T>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={rangeValue === "7d"}
            onCheckedChange={async (checked) => {
              await toggleRange("7d", checked);
            }}
          >
            <T>Last 7 days</T>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={rangeValue === "30d"}
            onCheckedChange={async (checked) => {
              await toggleRange("30d", checked);
            }}
          >
            <T>Last 30 days</T>
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={rangeValue === "custom"}
            onCheckedChange={async (checked) => {
              await toggleRange("custom", checked);
            }}
          >
            <T>Custom range</T>
          </DropdownMenuCheckboxItem>

          {customRange && (
            <>
              <DropdownMenuSeparator />
              <div className="flex flex-col gap-2 p-2">
                <Input
                  max={customRange.to}
                  onChange={async (event) => {
                    await setSearch((draft) => {
                      draft.range = { ...customRange, from: event.target.value };
                    });
                  }}
                  type="date"
                  value={customRange.from}
                />
                <Input
                  min={customRange.from}
                  onChange={async (event) => {
                    await setSearch((draft) => {
                      draft.range = { ...customRange, to: event.target.value };
                    });
                  }}
                  type="date"
                  value={customRange.to}
                />
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};
