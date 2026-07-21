import { Slider } from "@base-ui/react/slider";
import { useQuery } from "@tanstack/react-query";
import { useGT } from "gt-tanstack-start";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelCapability } from "@/lib/model-capability";
import { DEFAULT_MODEL_CAPABILITY, modelCapabilityLevels } from "@/lib/model-capability";
import { cn } from "@/lib/utils";

import { useSetModelCapability } from "../../-hooks/use-set-model-capability";
import { settingsQuery } from "../../-thread-api/settings";

const lastCapabilityIndex = modelCapabilityLevels.length - 1;

export const CapabilityPicker = () => {
  const gt = useGT();
  const { data } = useQuery({ ...settingsQuery(), select: (data) => data.modelCapability });
  const capability = data ?? DEFAULT_MODEL_CAPABILITY;
  const [index, setIndex] = useState(modelCapabilityLevels.indexOf(capability));
  const labels = {
    balanced: gt("Balanced"),
    max: gt("Max"),
    standard: gt("Standard"),
  } satisfies Record<ModelCapability, string>;
  const updateCapability = useSetModelCapability();
  const displayCapability = modelCapabilityLevels.at(index) ?? capability;

  return (
    <Popover>
      <PopoverTrigger render={<Button size="xs" variant="secondary" />}>
        {labels[displayCapability]}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="start" className="group/capability-popover w-auto p-3">
        <CapabilitySlider
          capability={capability}
          className="flex flex-col gap-2"
          index={index}
          label={gt("Capability")}
          labelClassName="text-xs"
          labels={labels}
          onIndexChange={(index) => {
            setIndex(index);

            const nextCapability = modelCapabilityLevels.at(index);

            if (nextCapability && nextCapability !== capability) {
              updateCapability.mutate(nextCapability);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

type CapabilitySliderProps = {
  capability: ModelCapability;
  className?: string;
  index: number;
  label: string;
  labelClassName?: string;
  labels: Record<ModelCapability, string>;
  onIndexChange: (index: number) => void;
};

const CapabilitySlider = ({
  capability,
  className,
  index,
  label,
  labelClassName,
  labels,
  onIndexChange,
}: CapabilitySliderProps) => {
  const [previewIndex, setPreviewIndex] = useState(index);

  return (
    <Slider.Root
      className={className}
      max={lastCapabilityIndex}
      min={0}
      onValueChange={setPreviewIndex}
      thumbAlignment="edge"
      onValueCommitted={onIndexChange}
      step={1}
      largeStep={1}
      minStepsBetweenValues={1}
      value={previewIndex}
    >
      <Slider.Label className={labelClassName}>{label}</Slider.Label>
      <Slider.Control className="w-36 data-dragging:cursor-grabbing">
        <Slider.Track className="relative h-6 w-full rounded-full bg-secondary">
          <Slider.Indicator
            className={cn(
              "rounded-l-full bg-muted-foreground group-not-data-starting-style/capability-popover:transition-[width]",
              previewIndex === 0 && "w-0",
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
                        onIndexChange(levelIndex);
                      }}
                      style={{ left: `${(levelIndex / lastCapabilityIndex) * 100}%` }}
                      type="button"
                    />
                  }
                >
                  <span
                    className={cn(
                      "size-1 rounded-full group-not-data-starting-style/capability-popover:transition-transform group-hover:scale-[1.5]",
                      levelIndex <= previewIndex ? "bg-background/50" : "bg-foreground/50",
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent className={cn(level === capability && "hidden")}>
                  {labels[level]}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <Slider.Thumb className="z-20 size-7 cursor-grab rounded-full bg-foreground group-not-data-starting-style/capability-popover:transition-[inset-inline-start] focus-visible:outline-none" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
};
