import { ExternalLinkIcon, XIcon } from "lucide-react";
import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useFocused, useSelected } from "platejs/react";
import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

import {
  MentionContent,
  MentionIcon,
  MentionLabel,
  MentionRemoveIcon,
  MentionRoot,
} from "./mention";
import {
  getComposerLinkLabel,
  removeComposerLink,
  unlinkComposerLink,
} from "./plate-plugins/link";

type TLinkElement = TElement & {
  type: "a";
  url: string;
};

type ThreadLinkElementProps = PlateElementProps<TLinkElement>;

export const ThreadLinkElement = (props: ThreadLinkElementProps) => {
  const { editor, element } = props;
  const selected = useSelected();
  const focused = useFocused();
  const href = element.url;

  const unlinkToText = () => {
    unlinkComposerLink(editor, element);
    editor.tf.focus();
  };

  const removeLink = () => {
    removeComposerLink(editor, element);
    editor.tf.focus();
  };

  const openLink = () => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <MentionRoot
      variant="neutral"
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
      <MentionContent>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center gap-1" type="button" />
            }
          >
            <MentionIcon
              variant="link"
              className="opacity-100 group-hover/mention:opacity-0"
            />
            <MentionLabel>{getComposerLinkLabel(href)}</MentionLabel>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="flex w-auto min-w-0 flex-row p-0.5"
            side="bottom"
          >
            <DropdownMenuItem
              className="min-h-6 gap-1 rounded-full px-1 py-0.5 text-xs"
              onClick={() => {
                openLink();
              }}
            >
              <ExternalLinkIcon className="size-3" />
              {m.composer_link_open()}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-6 gap-1 rounded-full px-1 py-0.5 text-xs"
              onClick={() => {
                unlinkToText();
              }}
            >
              <XIcon className="size-3" />
              {m.composer_link_unlink()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="absolute top-1/2 left-0 -translate-y-1/2 opacity-0 group-hover/mention:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            removeLink();
          }}
          type="button"
        >
          <MentionRemoveIcon />
        </button>
        {props.children}
      </MentionContent>
    </MentionRoot>
  );
};

export const ThreadLinkElementStatic = (
  props: SlateElementProps<TLinkElement>
) => {
  const href = props.element.url;

  return (
    <MentionRoot
      variant="neutral"
      render={(renderProps) => <SlateElement {...props} {...renderProps} />}
    >
      <MentionContent>
        <MentionIcon variant="link" />
        <MentionLabel>{getComposerLinkLabel(href)}</MentionLabel>
        {props.children}
      </MentionContent>
    </MentionRoot>
  );
};
