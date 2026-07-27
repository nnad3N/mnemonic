import { Slider } from "@base-ui/react/slider";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-tanstack-start";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelCapability } from "@/lib/model-capability";
import { modelCapabilityLevels } from "@/lib/model-capability";
import { cn } from "@/lib/utils";

import { useComposer } from "../../-hooks/use-composer";
import { useUpsertCapability } from "../../-hooks/use-upsert-capability";
import { settingsQuery } from "../../-thread-api/settings";

const lastCapabilityIndex = modelCapabilityLevels.length - 1;

export const CapabilityPicker = () => {
  const gt = useGT();
  const queryClient = useQueryClient();
  const { registerPortal } = useComposer();
  const userSettingsQuery = settingsQuery();
  const { data: capability } = useSuspenseQuery({
    ...userSettingsQuery,
    select: (data) => data.modelCapability,
  });
  const index = modelCapabilityLevels.indexOf(capability);
  const labels = {
    balanced: gt("Balanced"),
    max: gt("Max"),
    standard: gt("Standard"),
  } satisfies Record<ModelCapability, string>;
  const upsertCapability = useUpsertCapability();

  const setIndex = (index: number) => {
    const nextCapability = modelCapabilityLevels.at(index);
    if (!nextCapability) return;

    queryClient.setQueryData(userSettingsQuery.queryKey, {
      modelCapability: nextCapability,
    });
  };

  return (
    <Popover>
      <PopoverTrigger render={<Button size="xs" variant="secondary" />}>
        {labels[capability]}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="group/capability-popover w-auto p-3"
        ref={registerPortal}
      >
        <Slider.Root
          className="flex flex-col gap-2"
          max={lastCapabilityIndex}
          min={0}
          onValueChange={setIndex}
          thumbAlignment="edge"
          onValueCommitted={(index) => {
            const nextCapability = modelCapabilityLevels.at(index);

            if (nextCapability) {
              upsertCapability.mutate(nextCapability);
            }
          }}
          step={1}
          largeStep={1}
          minStepsBetweenValues={1}
          value={index}
        >
          <Slider.Label className="text-xs">{<T>Capability</T>}</Slider.Label>
          <Slider.Control className="w-36 data-dragging:cursor-grabbing">
            <Slider.Track className="relative h-6 w-full rounded-full bg-secondary dark:bg-muted">
              <Slider.Indicator
                className={cn(
                  "rounded-l-full bg-muted-foreground group-not-data-starting-style/capability-popover:transition-[width]",
                  index === 0 && "w-0",
                )}
              />

              <div className="absolute top-1/2 right-3 left-3 -translate-y-1/2">
                {modelCapabilityLevels.map((level, levelIndex) => (
                  <Tooltip key={level}>
                    <TooltipTrigger
                      render={
                        <button
                          className="group absolute top-1/2 z-10 flex h-6 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                          onClick={() => {
                            setIndex(levelIndex);
                          }}
                          style={{ left: `${(levelIndex / lastCapabilityIndex) * 100}%` }}
                          type="button"
                        />
                      }
                    >
                      <span
                        className={cn(
                          "size-1 rounded-full group-not-data-starting-style/capability-popover:transition-transform group-hover:scale-[1.5]",
                          levelIndex <= index ? "bg-background/50" : "bg-foreground/50",
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent
                      className={cn(level === capability && "hidden")}
                      ref={registerPortal}
                    >
                      {labels[level]}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Slider.Thumb className="z-20 size-7 cursor-grab rounded-full bg-foreground group-not-data-starting-style/capability-popover:transition-[inset-inline-start] focus-visible:outline-none" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      </PopoverContent>
    </Popover>
  );
};
