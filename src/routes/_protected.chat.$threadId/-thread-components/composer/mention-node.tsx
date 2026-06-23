import { getMentionOnSelectItem } from "@platejs/mention";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  FileIcon,
  Loader2Icon,
  TextIcon,
  XIcon,
} from "lucide-react";
import type { TComboboxInputElement, TMentionElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useFocused, useSelected } from "platejs/react";

import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/plate/autocomplete";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

import { mentionsQuery } from "../../-thread-api/get-mentions";
import { threadQuery } from "../../-thread-api/get-thread";
import { isMentionPending } from "../../-thread-utils";
import type { MentionValue, ParseMentionKeyResult } from "./plate-plugins";
import { getMentionKey, parseMentionKey } from "./plate-plugins";

export const ThreadMentionElement = (
  props: PlateElementProps<TMentionElement>
) => {
  const { element, editor, path } = props;
  const selected = useSelected();
  const focused = useFocused();
  const { type, value } = parseMentionKey(element.key);
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const topicId = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  }).data;
  const mention = useSuspenseQuery({
    ...mentionsQuery(topicId),
    select: (mentions) => mentions.find((item) => item.id === value),
  }).data;

  const isPending = mention && isMentionPending(mention);
  const isError = mention?.status === "failed";

  return (
    <PlateElement
      {...props}
      attributes={{
        ...props.attributes,
        contentEditable: false,
      }}
      className={cn(
        "mx-px inline-block translate-y-0.25 rounded-sm border border-teal-200 bg-teal-100 px-1 py-0.5 align-baseline",
        selected && focused && "ring-1 ring-ring",
        isError && "border-destructive/15 bg-destructive/10"
      )}
    >
      <button
        disabled={isPending}
        className="group flex items-center gap-1 text-sm leading-none font-medium select-none disabled:opacity-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          editor.tf.removeNodes({ at: path });
          editor.tf.focus();
        }}
      >
        <div className="relative size-3.25 shrink-0 [&_svg]:size-3.25">
          {isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <>
              <MentionIcon
                className="absolute inset-0 opacity-100 group-hover:opacity-0"
                isError={isError}
                type={type}
              />
              <XIcon className="absolute inset-0 scale-110 opacity-0 group-hover:opacity-100" />
            </>
          )}
        </div>
        {element.value}
        {props.children}
      </button>
    </PlateElement>
  );
};

type MentionIconProps = {
  className?: string;
  isError: boolean;
  type: ParseMentionKeyResult["type"];
};

const MentionIcon = ({ className, isError, type }: MentionIconProps) => {
  if (isError) {
    return <AlertTriangleIcon className={className} />;
  }

  if (type === "artifact") {
    return <FileIcon className={className} />;
  }

  return <TextIcon className={className} />;
};

const onSelectItem = getMentionOnSelectItem();

export const ThreadMentionInputElement = (
  props: PlateElementProps<TComboboxInputElement>
) => {
  const { editor, element } = props;
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const topicId = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.topicId,
  }).data;
  const mentionables = useSuspenseQuery({
    ...mentionsQuery(topicId),
    select: (mentions): MentionValue[] =>
      mentions.map((mention) => ({
        key: getMentionKey({ type: "artifact", value: mention.id }),
        text: mention.displayName,
      })),
  });

  return (
    <PlateElement {...props} as="span">
      <Autocomplete element={element} trigger="@" items={mentionables.data}>
        <AutocompleteInput />
        <AutocompleteContent>
          <AutocompleteEmpty>{m.common_no_results()}</AutocompleteEmpty>
          <AutocompleteList>
            {(item) => (
              <AutocompleteItem
                key={item.key}
                onClick={() => {
                  onSelectItem(editor, item);
                }}
                value={item}
              >
                {item.text}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
      {props.children}
    </PlateElement>
  );
};
