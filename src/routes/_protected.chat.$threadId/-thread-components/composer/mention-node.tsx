import { getMentionOnSelectItem } from "@platejs/mention";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { TComboboxInputElement, TMentionElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useFocused, useSelected } from "platejs/react";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useShallow } from "zustand/shallow";

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

import {
  mentionByIdQuery,
  mentionsQuery,
} from "../../-thread-api/get-mentions";
import { threadQuery } from "../../-thread-api/get-thread";
import { isMentionPending } from "../../-thread-utils";
import type { ThreadAttachment } from "../../../-chat-store";
import { useChatStore } from "../../../-chat-store";
import {
  MentionContent,
  MentionLabel,
  MentionRoot,
  MentionIcon,
  MentionRemoveIcon,
} from "./mention";
import type { MentionVariant } from "./mention";
import type {
  MentionValue,
  ParseMentionKeyResult,
} from "./plate-plugins/mention-key";
import { getMentionKey, parseMentionKey } from "./plate-plugins/mention-key";

type MentionType = ParseMentionKeyResult["type"];

type ThreadMentionState = {
  status?: "failed" | "pending" | "ready";
  type: MentionType;
};

const useThreadMentionState = (
  element: TMentionElement
): ThreadMentionState => {
  const { type, value: mentionId } = parseMentionKey(element.key);
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const attachment = useChatStore(
    useShallow((state) =>
      state.attachments.get(threadId)?.find((a) => a.sha256 === mentionId)
    )
  );

  const { data: mention, isLoading } = useQuery({
    ...mentionByIdQuery({ artifactId: mentionId }),
    enabled: type === "artifact",
  });

  if (attachment) {
    const status = attachment.status;

    return {
      status: status === "persisted" ? "ready" : status,
      type,
    };
  }

  if (isLoading || (mention && isMentionPending(mention))) {
    return {
      status: "pending",
      type,
    };
  }

  return {
    status:
      mention?.status === "ready" || mention?.status === "failed"
        ? mention.status
        : undefined,
    type,
  };
};

const getMentionVariant = (
  mentionState: ThreadMentionState
): MentionVariant => {
  if (mentionState.status === "failed") {
    return "error";
  }

  if (!mentionState.status) {
    return "neutral";
  }

  return "teal";
};

export const ThreadMentionElement = (
  props: PlateElementProps<TMentionElement>
) => {
  const { editor, path, element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const mentionState = useThreadMentionState(element);
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const removeAttachment = useChatStore((state) => state.removeAttachment);
  const { value: mentionId } = parseMentionKey(element.key);

  const isDisabled = mentionState.status === "pending";

  return (
    <MentionRoot
      variant={getMentionVariant(mentionState)}
      className={cn(selected && focused && "ring-1 ring-ring")}
      render={(renderProps) => (
        <PlateElement
          {...props}
          {...renderProps}
          attributes={{
            ...props.attributes,
            contentEditable: false,
          }}
        />
      )}
    >
      <MentionContent
        render={
          <button
            className="disabled:opacity-50"
            disabled={isDisabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editor.tf.removeNodes({ at: path });
              removeAttachment(threadId, mentionId);
              editor.tf.focus();
            }}
            type="button"
          />
        }
      >
        {isDisabled ? (
          <MentionIcon variant={mentionState.type} />
        ) : (
          <MentionStateIcon mentionState={mentionState} />
        )}
        <MentionLabel>{props.element.value}</MentionLabel>
        {props.children}
      </MentionContent>
    </MentionRoot>
  );
};

export const ThreadMentionElementStatic = (
  props: SlateElementProps<TMentionElement>
) => {
  const mentionState = useThreadMentionState(props.element);

  return (
    <MentionRoot
      variant={getMentionVariant(mentionState)}
      render={(renderProps) => <SlateElement {...props} {...renderProps} />}
    >
      <MentionContent>
        <MentionStateIcon mentionState={mentionState} />
        <MentionLabel>{props.element.value}</MentionLabel>
        {props.children}
      </MentionContent>
    </MentionRoot>
  );
};

type MentionStateIconProps = {
  mentionState: ThreadMentionState;
};

const MentionStateIcon = ({ mentionState }: MentionStateIconProps) => {
  return (
    <div className="relative size-3.25 shrink-0">
      {mentionState.status === "pending" ? (
        <MentionIcon variant="pending" className="animate-spin" />
      ) : (
        <>
          <MentionIcon
            variant={mentionState.type}
            className="absolute inset-0 opacity-100 group-hover/mention:opacity-0"
          />
          <MentionRemoveIcon className="absolute inset-0 opacity-0 group-hover/mention:opacity-100" />
        </>
      )}
    </div>
  );
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
  const resourceId = useSuspenseQuery({
    ...threadQuery(threadId),
    select: (data) => data.resourceId,
  }).data;
  const attachments = useChatStore((state) => state.attachments.get(threadId));
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 100);
  const mentions = useQuery({
    ...mentionsQuery({ query: debouncedSearch, resourceId }),
    select: (data) =>
      data
        .filter(
          (mention) => mention.type !== "thread" || mention.id !== threadId
        )
        .map(
          (mention): MentionValue => ({
            key: getMentionKey({ type: mention.type, value: mention.id }),
            text: mention.displayName,
            type: mention.type,
          })
        ),
  });

  const items = useMemo(() => {
    const trimmedQuery = debouncedSearch.trim().toLowerCase();
    let filteredAttachments: ThreadAttachment[] = [];

    if (trimmedQuery.length > 0) {
      filteredAttachments =
        attachments?.filter((attachment) =>
          attachment.filename.toLowerCase().includes(trimmedQuery)
        ) ?? [];
    } else {
      filteredAttachments = attachments ?? [];
    }

    const composerAttachments = filteredAttachments.map(
      (attachment): MentionValue => ({
        key: getMentionKey({ type: "attachment", value: attachment.sha256 }),
        text: attachment.filename,
        type: "attachment",
      })
    );
    const mentionsData = mentions.data ?? [];

    return [...composerAttachments, ...mentionsData];
  }, [attachments, debouncedSearch, mentions.data]);

  return (
    <PlateElement {...props} as="span">
      <Autocomplete
        element={element}
        items={items}
        setValue={setSearch}
        trigger="@"
        value={search}
      >
        <AutocompleteInput />
        <AutocompleteContent side="top">
          <AutocompleteEmpty>
            {mentions.isLoading ? m.common_loading() : m.common_no_results()}
          </AutocompleteEmpty>
          <AutocompleteList>
            {(item) => (
              <AutocompleteItem
                key={item.key}
                onClick={() => {
                  onSelectItem(editor, item);
                }}
                value={item}
              >
                <MentionIcon variant={item.type} />
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
