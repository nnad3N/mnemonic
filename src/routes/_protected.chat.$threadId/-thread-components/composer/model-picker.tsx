import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useGT } from "gt-tanstack-start";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ModelOption } from "@/lib/model-option";
import { ModelOptions } from "@/lib/model-option";

import { useComposer } from "../../-hooks/use-composer";
import { useUpsertModelOption } from "../../-hooks/use-upsert-model-option";
import { threadSettingsQueries } from "../../-thread-api/thread-settings.functions";

export const ModelPicker = () => {
  const gt = useGT();
  const { registerPortal } = useComposer();
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const { data: modelOption } = useSuspenseQuery({
    ...threadSettingsQueries.byThread(threadId),
    select: (data) => data.modelOption,
  });
  const labels = {
    analysis: gt("Analysis"),
    knowledge: gt("Knowledge"),
    research: gt("Research"),
  } satisfies Record<ModelOption, string>;
  const upsertModelOption = useUpsertModelOption(threadId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button data-test-id="model-picker-trigger" size="xs" variant="secondary" />}
      >
        {labels[modelOption]}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto" ref={registerPortal}>
        <DropdownMenuRadioGroup
          value={modelOption}
          onValueChange={(value) => {
            if (ModelOptions.is(value)) {
              upsertModelOption.mutate(value);
            }
          }}
        >
          {ModelOptions.values.map((option) => (
            <DropdownMenuRadioItem
              closeOnClick
              data-test-id={`model-option-${option}`}
              key={option}
              value={option}
            >
              {labels[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
