import { useRender } from "@base-ui/react/use-render";
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
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";
import type { PropsWithChildren } from "react";

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
import type { MentionValue, ParseMentionKeyResult } from "./plate-plugins";
import { getMentionKey, parseMentionKey } from "./plate-plugins";

type ThreadMentionState = {
  status?: "failed" | "pending" | "ready";
  type: ParseMentionKeyResult["type"];
};

const useThreadMentionState = (
  element: TMentionElement
): ThreadMentionState => {
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

  if (mention?.status === "uploading" || mention?.status === "processing") {
    return {
      status: "pending",
      type,
    };
  }

  return {
    status: mention?.status,
    type,
  };
};

type ThreadMentionRootProps = PropsWithChildren<{
  className?: string;
  mentionState: ThreadMentionState;
  render: useRender.ComponentProps<"span">["render"];
}>;

const ThreadMentionRoot = ({
  render,
  className,
  children,
  mentionState,
}: ThreadMentionRootProps) =>
  useRender({
    render,
    props: {
      className: cn(
        "mx-px inline-block translate-y-0.25 rounded-sm border border-teal-200 bg-teal-100 px-1 py-0.5 align-baseline",
        mentionState.status === "failed" &&
          "border-destructive/15 bg-destructive/10",
        !mentionState.status && "border-gray-300 bg-gray-200/50",
        className
      ),
      children,
    },
  });

type ThreadMentionElementContentProps = {
  mentionState: ThreadMentionState;
  render: useRender.ComponentProps<"span">["render"];
};

const ThreadMentionElementContent = ({
  render,
  children,
  mentionState,
}: PropsWithChildren<ThreadMentionElementContentProps>) =>
  useRender({
    defaultTagName: "span",
    render,
    props: {
      className:
        "flex items-center gap-1 text-sm leading-none font-medium select-none",
      children: (
        <>
          <div className="relative size-3.25 shrink-0 [&_svg]:size-3.25">
            {mentionState.status === "pending" ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <>
                <MentionIcon
                  className="absolute inset-0 opacity-100 group-hover:opacity-0"
                  mentionState={mentionState}
                />
                <XIcon className="absolute inset-0 scale-110 opacity-0 group-hover:opacity-100" />
              </>
            )}
          </div>

          {children}
        </>
      ),
    },
  });

export const ThreadMentionElement = (
  props: PlateElementProps<TMentionElement>
) => {
  const { editor, path } = props;
  const selected = useSelected();
  const focused = useFocused();
  const mentionState = useThreadMentionState(props.element);

  return (
    <ThreadMentionRoot
      mentionState={mentionState}
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
      <ThreadMentionElementContent
        mentionState={mentionState}
        render={
          <button
            className="group disabled:opacity-50"
            disabled={mentionState.status === "pending"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editor.tf.removeNodes({ at: path });
              editor.tf.focus();
            }}
            type="button"
          />
        }
      >
        {props.element.value}
        {props.children}
      </ThreadMentionElementContent>
    </ThreadMentionRoot>
  );
};

export const ThreadMentionElementStatic = (
  props: SlateElementProps<TMentionElement>
) => {
  const mentionState = useThreadMentionState(props.element);

  return (
    <ThreadMentionRoot
      mentionState={mentionState}
      render={(renderProps) => <SlateElement {...props} {...renderProps} />}
    >
      <ThreadMentionElementContent
        mentionState={mentionState}
        render={<span />}
      >
        {props.element.value}
        {props.children}
      </ThreadMentionElementContent>
    </ThreadMentionRoot>
  );
};

type MentionIconProps = {
  className?: string;
  mentionState: ThreadMentionState;
};

const MentionIcon = ({ className, mentionState }: MentionIconProps) => {
  if (mentionState.status === "failed") {
    return <AlertTriangleIcon className={className} />;
  }

  if (mentionState.type === "artifact") {
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
