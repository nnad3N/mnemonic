import { getMentionOnSelectItem } from "@platejs/mention";
import { useMutationState } from "@tanstack/react-query";
import type { MutationStatus } from "@tanstack/react-query";
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

import { threadMutationKeys } from "../../-thread-api/query-keys";
import type { UploadFileMutationState } from "../../-thread-api/upload-file";
import type { MentionValue, ParseMentionKeyResult } from "./plate-plugins";
import { parseMentionKey } from "./plate-plugins";

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

  const mutationState = useMutationState<UploadFileMutationState>({
    filters: {
      mutationKey: threadMutationKeys.uploadFile(threadId),
    },
  }).find((mutation) => mutation.variables?.artifactId === value);
  const status = mutationState?.status;

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
        status === "error" && "border-destructive/15 bg-destructive/10"
      )}
    >
      <button
        disabled={status === "pending"}
        className="group flex items-center gap-1 text-sm leading-none font-medium select-none disabled:opacity-50"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          editor.tf.removeNodes({ at: path });
          editor.tf.focus();
        }}
      >
        <div className="relative size-3.25 shrink-0 [&_svg]:size-3.25">
          {status === "pending" ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <>
              <MentionIcon
                className="absolute inset-0 opacity-100 group-hover:opacity-0"
                status={status}
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
  status: MutationStatus | undefined;
  type: ParseMentionKeyResult["type"];
};

const MentionIcon = ({ className, status, type }: MentionIconProps) => {
  if (status === "error") {
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

  return (
    <PlateElement {...props} as="span">
      <Autocomplete element={element} trigger="@" items={MENTIONABLES}>
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

const MENTIONABLES: MentionValue[] = [
  { key: "artifact::123", text: "File 1" },
  { key: "artifact::456", text: "File 2" },
];
