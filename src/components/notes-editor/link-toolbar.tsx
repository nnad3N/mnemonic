import { flip, offset } from "@platejs/floating";
import type { UseVirtualFloatingOptions } from "@platejs/floating";
import { getLinkAttributes } from "@platejs/link";
import {
  FloatingLinkUrlInput,
  useFloatingLinkEdit,
  useFloatingLinkEditState,
  useFloatingLinkInsert,
  useFloatingLinkInsertState,
} from "@platejs/link/react";
import { T, useGT } from "gt-tanstack-start";
import { ExternalLinkIcon, LinkIcon, TextIcon, UnlinkIcon } from "lucide-react";
import type { TLinkElement } from "platejs";
import { KEYS } from "platejs";
import { useEditorRef, useEditorSelection, useFormInputProps } from "platejs/react";
import type { ComponentProps } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { NoteToolbarSeparator } from "./toolbar-buttons";

const floatingOptions: UseVirtualFloatingOptions = {
  middleware: [
    offset(8),
    flip({ fallbackPlacements: ["bottom-end", "top-start", "top-end"], padding: 12 }),
  ],
  placement: "bottom-start",
};

const NoteLinkPopup = (props: ComponentProps<"div">) => (
  <div
    className="z-50 w-auto rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-hidden dark:ring-foreground/10"
    {...props}
  />
);

export const NoteLinkToolbar = () => {
  const insertState = useFloatingLinkInsertState({ floatingOptions });
  const {
    hidden,
    props: insertProps,
    ref: insertRef,
    textInputProps,
  } = useFloatingLinkInsert(insertState);
  const editState = useFloatingLinkEditState({ floatingOptions });
  const {
    editButtonProps,
    props: editProps,
    ref: editRef,
    unlinkButtonProps,
  } = useFloatingLinkEdit(editState);

  if (hidden === true) {
    return null;
  }

  return (
    <>
      <NoteLinkPopup ref={insertRef} {...insertProps}>
        <NoteLinkFields textInputProps={textInputProps} />
      </NoteLinkPopup>
      <NoteLinkPopup ref={editRef} {...editProps}>
        {editState.isEditing ? (
          <NoteLinkFields textInputProps={textInputProps} />
        ) : (
          <div className="flex items-center gap-1">
            <Button size="sm" type="button" variant="ghost" {...editButtonProps}>
              <T>Edit link</T>
            </Button>
            <NoteToolbarSeparator />
            <NoteLinkOpenButton />
            <Button size="icon-sm" type="button" variant="ghost" {...unlinkButtonProps}>
              <UnlinkIcon />
            </Button>
          </div>
        )}
      </NoteLinkPopup>
    </>
  );
};

type NoteLinkFieldsProps = {
  textInputProps: ReturnType<typeof useFloatingLinkInsert>["textInputProps"];
};

const NoteLinkFields = ({ textInputProps }: NoteLinkFieldsProps) => {
  const gt = useGT();
  const formInputProps = useFormInputProps({ preventDefaultOnEnterKeydown: true });

  return (
    <div className="flex w-80 flex-col" {...formInputProps}>
      <div className="flex items-center pl-2 text-muted-foreground">
        <LinkIcon className="size-4" />
        <FloatingLinkUrlInput
          className="h-7 w-full bg-transparent px-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          data-plate-focus
          placeholder={gt("Paste link")}
        />
      </div>
      <Separator className="my-1" />
      <div className="flex items-center pl-2 text-muted-foreground">
        <TextIcon className="size-4" />
        <input
          className="h-7 w-full bg-transparent px-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          data-plate-focus
          placeholder={gt("Text to display")}
          {...textInputProps}
        />
      </div>
    </div>
  );
};

const NoteLinkOpenButton = () => {
  const editor = useEditorRef();
  // Selection is not read, but moving it changes which link the button opens.
  useEditorSelection();
  const entry = editor.api.node<TLinkElement>({ match: { type: editor.getType(KEYS.link) } });

  if (!entry) return;

  return (
    <a
      className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
      rel="noopener"
      target="_blank"
      {...getLinkAttributes(editor, entry[0])}
    >
      <ExternalLinkIcon />
      <span className="sr-only">
        <T>Open link</T>
      </span>
    </a>
  );
};
