import { Slider } from "@base-ui/react/slider";
import { ChevronDownIcon } from "lucide-react";
import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SliderSelectProps<Option extends string> = {
  label: string;
  labels: Record<Option, string>;
  onValueChange: (option: Option) => void;
  onValueCommitted: (option: Option) => void;
  options: readonly Option[];
  portalRef?: Ref<HTMLDivElement>;
  value: Option;
};

export const SliderSelect = <Option extends string>({
  label,
  labels,
  onValueChange,
  onValueCommitted,
  options,
  portalRef,
  value,
}: SliderSelectProps<Option>) => {
  const lastOptionIndex = options.length - 1;
  const index = options.indexOf(value);

  const setIndex = (index: number) => {
    const nextOption = options.at(index);

    if (nextOption) {
      onValueChange(nextOption);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={<Button data-test-id="slider-select-trigger" size="xs" variant="secondary" />}
      >
        {labels[value]}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="group/slider-select-popover w-auto p-3"
        data-test-id="slider-select-popover"
        ref={portalRef}
      >
        <Slider.Root
          className="flex flex-col gap-2"
          max={lastOptionIndex}
          min={0}
          onValueChange={setIndex}
          thumbAlignment="edge"
          onValueCommitted={(index) => {
            const nextOption = options.at(index);

            if (nextOption) {
              onValueCommitted(nextOption);
            }
          }}
          step={1}
          largeStep={1}
          minStepsBetweenValues={1}
          value={index}
        >
          <Slider.Label className="text-xs">{label}</Slider.Label>
          <Slider.Control className="w-36 data-dragging:cursor-grabbing">
            <Slider.Track className="relative h-6 w-full rounded-full bg-secondary dark:bg-muted">
              <Slider.Indicator
                className={cn(
                  "rounded-l-full bg-muted-foreground group-not-data-starting-style/slider-select-popover:transition-[width]",
                  index === 0 && "w-0",
                )}
              />

              <div className="absolute top-1/2 right-3 left-3 -translate-y-1/2">
                {options.map((option, optionIndex) => (
                  <Tooltip key={option}>
                    <TooltipTrigger
                      render={
                        <button
                          className="group absolute top-1/2 z-10 flex h-6 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                          data-test-id={`slider-select-option-${option}`}
                          onClick={() => {
                            setIndex(optionIndex);
                          }}
                          style={{ left: `${(optionIndex / lastOptionIndex) * 100}%` }}
                          type="button"
                        />
                      }
                    >
                      <span
                        className={cn(
                          "size-1 rounded-full group-not-data-starting-style/slider-select-popover:transition-transform group-hover:scale-[1.5]",
                          optionIndex <= index ? "bg-background/50" : "bg-foreground/50",
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent className={cn(option === value && "hidden")} ref={portalRef}>
                      {labels[option]}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Slider.Thumb className="z-20 size-7 cursor-grab rounded-full bg-foreground group-not-data-starting-style/slider-select-popover:transition-[inset-inline-start] focus-visible:outline-none" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      </PopoverContent>
    </Popover>
  );
};
