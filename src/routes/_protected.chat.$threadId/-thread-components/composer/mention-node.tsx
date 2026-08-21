import { getMentionOnSelectItem } from "@platejs/mention";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { T } from "gt-tanstack-start";
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
import type { MentionValue, ParseMentionKeyResult } from "@/lib/mention-key";
import { getMentionKey, parseMentionKey } from "@/lib/mention-key";
import { cn } from "@/lib/utils";

import { useComposer } from "../../-hooks/use-composer";
import { threadQueries } from "../../-hooks/use-thread-chat";
import { mentionQueries } from "../../-thread-api/mentions.functions";
import type { MentionQueryType } from "../../-thread-api/mentions.server";
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

type MentionStatus = "failed" | "pending" | "ready" | undefined;
type MentionType = ParseMentionKeyResult["type"];

const getMentionVariant = (status: MentionStatus): MentionVariant => {
  if (status === "failed") {
    return "error";
  }

  if (!status) {
    return "neutral";
  }

  return "cyan";
};

export const ThreadMentionElement = (props: PlateElementProps<TMentionElement>) => {
  const { type, value: mentionId } = parseMentionKey(props.element.key);

  if (type === "attachment" || type === "selection" || type === "unknown") {
    return <ThreadLocalMentionElement {...props} mentionId={mentionId} mentionType={type} />;
  }

  return <ThreadDatabaseMentionElement {...props} mentionId={mentionId} mentionType={type} />;
};

type ThreadDatabaseMentionElementProps = PlateElementProps<TMentionElement> & {
  mentionId: string;
  mentionType: MentionQueryType;
};

const ThreadDatabaseMentionElement = ({
  mentionId,
  mentionType,
  ...props
}: ThreadDatabaseMentionElementProps) => {
  const mention = useQuery(
    mentionQueries.byId({
      id: mentionId,
      type: mentionType,
    }),
  );

  const mentionStatus = useMemo((): MentionStatus => {
    if (mention.isLoading) {
      return "ready";
    }

    if (!mention.isSuccess) {
      return "failed";
    }

    if (!mention.data) {
      return undefined;
    }

    const status = mention.data.status;

    if (status === "processing" || status === "uploading") {
      return "pending";
    }

    return status;
  }, [mention]);

  return (
    <ThreadMentionElementContent
      {...props}
      mentionId={mentionId}
      mentionType={mentionType}
      mentionStatus={mentionStatus}
    />
  );
};

type ThreadLocalMentionElementProps = PlateElementProps<TMentionElement> & {
  mentionId: string;
  mentionType: Exclude<MentionType, MentionQueryType>;
};

const ThreadLocalMentionElement = ({
  mentionId,
  mentionType,
  ...props
}: ThreadLocalMentionElementProps) => {
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const attachment = useChatStore(
    useShallow((state) => state.attachments.get(threadId)?.find((a) => a.sha256 === mentionId)),
  );
  const mentionStatus = useMemo((): MentionStatus => {
    if (mentionType === "selection") {
      return "ready";
    }

    if (mentionType !== "attachment" || !attachment) {
      return undefined;
    }

    return "ready";
  }, [attachment, mentionType]);

  return (
    <ThreadMentionElementContent
      {...props}
      mentionId={mentionId}
      mentionType={mentionType}
      mentionStatus={mentionStatus}
    />
  );
};

type ThreadMentionElementContentProps = PlateElementProps<TMentionElement> & {
  mentionId: string;
  mentionType: MentionType;
  mentionStatus: MentionStatus;
};

const ThreadMentionElementContent = ({
  mentionId,
  mentionType,
  mentionStatus,
  ...props
}: ThreadMentionElementContentProps) => {
  const { editor, path } = props;
  const selected = useSelected();
  const focused = useFocused();
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const removeAttachment = useChatStore((state) => state.removeAttachment);

  const isDisabled = mentionStatus === "pending";

  return (
    <MentionRoot
      variant={getMentionVariant(mentionStatus)}
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
          <MentionIcon variant={mentionStatus} />
        ) : (
          <div className="relative size-3.25 shrink-0">
            <MentionIcon
              variant={mentionType}
              className="absolute inset-0 opacity-100 group-hover/mention:opacity-0"
            />
            <MentionRemoveIcon className="absolute inset-0 opacity-0 group-hover/mention:opacity-100" />
          </div>
        )}
        <MentionLabel>{props.element.value}</MentionLabel>
        {props.children}
      </MentionContent>
    </MentionRoot>
  );
};

export const ThreadMentionElementStatic = (props: SlateElementProps<TMentionElement>) => {
  const mention = parseMentionKey(props.element.key);

  return (
    <MentionRoot
      variant="cyan"
      render={(renderProps) => <SlateElement {...props} {...renderProps} />}
    >
      <MentionContent>
        <MentionIcon variant={mention.type} />
        <MentionLabel>{props.element.value}</MentionLabel>
        {props.children}
      </MentionContent>
    </MentionRoot>
  );
};

const onSelectItem = getMentionOnSelectItem();

export const ThreadMentionInputElement = (props: PlateElementProps<TComboboxInputElement>) => {
  const { editor, element } = props;
  const threadId = useParams({
    from: "/_protected/chat/$threadId",
    select: (params) => params.threadId,
  });
  const { data: resourceId } = useSuspenseQuery({
    ...threadQueries.chat(threadId),
    select: (data) => data.resourceId,
  });
  const attachments = useChatStore((state) => state.attachments.get(threadId));
  const { registerPortal } = useComposer();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 100);
  const mentions = useQuery({
    ...mentionQueries.list({ query: debouncedSearch, resourceId }),
    select: (data) =>
      data
        .filter((mention) => mention.type !== "thread" || mention.id !== threadId)
        .map(
          (mention): MentionValue => ({
            key: getMentionKey({ type: mention.type, value: mention.id }),
            text: mention.displayName,
            type: mention.type,
          }),
        ),
  });

  const items = useMemo(() => {
    const trimmedQuery = debouncedSearch.trim().toLowerCase();
    let filteredAttachments: ThreadAttachment[] = [];

    if (trimmedQuery.length > 0) {
      filteredAttachments =
        attachments?.filter((attachment) =>
          attachment.filename.toLowerCase().includes(trimmedQuery),
        ) ?? [];
    } else {
      filteredAttachments = attachments ?? [];
    }

    const composerAttachments = filteredAttachments.map(
      (attachment): MentionValue => ({
        key: getMentionKey({ type: "attachment", value: attachment.sha256 }),
        text: attachment.filename,
        type: "attachment",
      }),
    );
    const mentionsData = mentions.data ?? [];

    return [...composerAttachments, ...mentionsData];
  }, [attachments, debouncedSearch, mentions.data]);

  return (
    <PlateElement {...props} as="span">
      <Autocomplete element={element} items={items} setValue={setSearch} trigger="@" value={search}>
        <AutocompleteInput />
        <AutocompleteContent ref={registerPortal} side="top">
          <AutocompleteEmpty>
            {mentions.isLoading ? <T>Loading…</T> : <T>No results</T>}
          </AutocompleteEmpty>
          <AutocompleteList>
            {(item: MentionValue) => (
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
