import { useIndentButton, useOutdentButton } from "@platejs/indent/react";
import { useLinkToolbarButton, useLinkToolbarButtonState } from "@platejs/link/react";
import { someList, toggleList } from "@platejs/list";
import { useGT } from "gt-tanstack-start";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  IndentIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  OutdentIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { KEYS } from "platejs";
import {
  useEditorRef,
  useEditorSelector,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
  useSelectionFragmentProp,
} from "platejs/react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { getBlockType, setBlockType } from "./block-type";

export const NoteToolbarSeparator = () => (
  <Separator className="mx-1 h-5 data-vertical:self-center" orientation="vertical" />
);

type NoteToolbarButtonProps = Omit<ComponentProps<typeof Button>, "render"> & {
  pressed?: boolean;
  tooltip: ReactNode;
};

export const NoteToolbarButton = ({
  className,
  pressed,
  tooltip,
  ...props
}: NoteToolbarButtonProps) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          aria-pressed={pressed}
          className={cn("rounded-lg aria-pressed:bg-muted", className)}
          size="icon-sm"
          type="button"
          variant="ghost"
          {...props}
        />
      }
    />
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);

type NoteMarkButtonProps = {
  icon: ReactNode;
  nodeType: string;
  tooltip: ReactNode;
};

export const NoteMarkButton = ({ icon, nodeType, tooltip }: NoteMarkButtonProps) => {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props: buttonProps } = useMarkToolbarButton(state);

  return (
    <NoteToolbarButton tooltip={tooltip} {...buttonProps}>
      {icon}
    </NoteToolbarButton>
  );
};

export const NoteMarkButtons = () => {
  const gt = useGT();

  return (
    <>
      <NoteMarkButton icon={<BoldIcon />} nodeType={KEYS.bold} tooltip={gt("Bold")} />
      <NoteMarkButton icon={<ItalicIcon />} nodeType={KEYS.italic} tooltip={gt("Italic")} />
      <NoteMarkButton
        icon={<UnderlineIcon />}
        nodeType={KEYS.underline}
        tooltip={gt("Underline")}
      />
      <NoteMarkButton
        icon={<StrikethroughIcon />}
        nodeType={KEYS.strikethrough}
        tooltip={gt("Strikethrough")}
      />
      <NoteMarkButton icon={<CodeIcon />} nodeType={KEYS.code} tooltip={gt("Code")} />
    </>
  );
};

export const NoteTurnIntoButton = () => {
  const gt = useGT();
  const editor = useEditorRef();
  const blockType = useSelectionFragmentProp({
    defaultValue: KEYS.p,
    getProp: (node) => getBlockType(node),
  });

  const items = [
    { icon: <PilcrowIcon />, label: gt("Text"), value: KEYS.p },
    { icon: <Heading1Icon />, label: gt("Heading 1"), value: KEYS.h1 },
    { icon: <Heading2Icon />, label: gt("Heading 2"), value: KEYS.h2 },
    { icon: <Heading3Icon />, label: gt("Heading 3"), value: KEYS.h3 },
    { icon: <ListIcon />, label: gt("Bulleted list"), value: KEYS.ul },
    { icon: <ListOrderedIcon />, label: gt("Numbered list"), value: KEYS.ol },
    { icon: <ListTodoIcon />, label: gt("To-do list"), value: KEYS.listTodo },
    { icon: <QuoteIcon />, label: gt("Quote"), value: KEYS.blockquote },
    { icon: <SquareCodeIcon />, label: gt("Code block"), value: KEYS.codeBlock },
  ];
  const selected = items.find((item) => item.value === blockType) ?? items[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button className="w-40 justify-between" size="sm" variant="ghost" />}
      >
        {selected.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            setBlockType(editor, value);
            editor.tf.focus();
          }}
          value={blockType}
        >
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              {item.icon}
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const NoteLinkButton = () => {
  const gt = useGT();
  const state = useLinkToolbarButtonState();
  const { props: buttonProps } = useLinkToolbarButton(state);

  return (
    <NoteToolbarButton tooltip={gt("Link")} {...buttonProps}>
      <LinkIcon />
    </NoteToolbarButton>
  );
};

type NoteListButtonProps = {
  icon: ReactNode;
  listStyleType: string;
  tooltip: ReactNode;
};

const NoteListButton = ({ icon, listStyleType, tooltip }: NoteListButtonProps) => {
  const editor = useEditorRef();
  const pressed = useEditorSelector((editor) => someList(editor, listStyleType), [listStyleType]);

  return (
    <NoteToolbarButton
      onClick={() => {
        toggleList(editor, { listStyleType });
        editor.tf.focus();
      }}
      pressed={pressed}
      tooltip={tooltip}
    >
      {icon}
    </NoteToolbarButton>
  );
};

export const NoteListButtons = () => {
  const gt = useGT();

  return (
    <>
      <NoteListButton icon={<ListIcon />} listStyleType={KEYS.ul} tooltip={gt("Bulleted list")} />
      <NoteListButton
        icon={<ListOrderedIcon />}
        listStyleType={KEYS.ol}
        tooltip={gt("Numbered list")}
      />
      <NoteListButton
        icon={<ListTodoIcon />}
        listStyleType={KEYS.listTodo}
        tooltip={gt("To-do list")}
      />
    </>
  );
};

export const NoteIndentButtons = () => {
  const gt = useGT();
  const { props: indentProps } = useIndentButton();
  const { props: outdentProps } = useOutdentButton();

  return (
    <>
      <NoteToolbarButton tooltip={gt("Outdent")} {...outdentProps}>
        <OutdentIcon />
      </NoteToolbarButton>
      <NoteToolbarButton tooltip={gt("Indent")} {...indentProps}>
        <IndentIcon />
      </NoteToolbarButton>
    </>
  );
};

export const NoteHistoryButtons = () => {
  const gt = useGT();
  const editor = useEditorRef();
  const { canRedo, canUndo } = useEditorSelector(
    (editor) => ({
      canRedo: editor.history.redos.length > 0,
      canUndo: editor.history.undos.length > 0,
    }),
    [],
  );

  return (
    <>
      <NoteToolbarButton
        disabled={!canUndo}
        onClick={() => {
          editor.tf.undo();
          editor.tf.focus();
        }}
        tooltip={gt("Undo")}
      >
        <Undo2Icon />
      </NoteToolbarButton>
      <NoteToolbarButton
        disabled={!canRedo}
        onClick={() => {
          editor.tf.redo();
          editor.tf.focus();
        }}
        tooltip={gt("Redo")}
      >
        <Redo2Icon />
      </NoteToolbarButton>
    </>
  );
};

export const NoteClearFormattingButton = () => {
  const gt = useGT();
  const editor = useEditorRef();

  return (
    <NoteToolbarButton
      onClick={() => {
        editor.tf.removeMarks();
        setBlockType(editor, KEYS.p);
        editor.tf.focus();
      }}
      tooltip={gt("Clear formatting")}
    >
      <RemoveFormattingIcon />
    </NoteToolbarButton>
  );
};
