import { useIndentButton, useOutdentButton } from "@platejs/indent/react";
import { useLinkToolbarButton, useLinkToolbarButtonState } from "@platejs/link/react";
import { someList, toggleList } from "@platejs/list";
import { insertEquation, insertInlineEquation } from "@platejs/math";
import { TablePlugin } from "@platejs/table/react";
import { useGT } from "gt-tanstack-start";
import {
  BoldIcon,
  CodeIcon,
  EllipsisIcon,
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
  RadicalIcon,
  Redo2Icon,
  RemoveFormattingIcon,
  SquareCodeIcon,
  SquareRadicalIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  Undo2Icon,
} from "lucide-react";
import { KEYS } from "platejs";
import {
  useEditorPlugin,
  useEditorRef,
  useEditorSelector,
  useMarkToolbarButton,
  useMarkToolbarButtonState,
  useSelectionFragmentProp,
} from "platejs/react";
import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

type NoteToolbarMenuTriggerProps = {
  children: ReactNode;
  tooltip: ReactNode;
};

const NoteToolbarMenuTrigger = ({ children, tooltip }: NoteToolbarMenuTriggerProps) => (
  <Tooltip>
    <TooltipTrigger
      render={<DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" />} />}
    >
      {children}
    </TooltipTrigger>
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
      <DropdownMenuContent align="start" className="min-w-48" finalFocus={false}>
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

type NoteFormatMarkItemProps = {
  icon: ReactNode;
  label: string;
  nodeType: string;
};

const NoteFormatMarkItem = ({ icon, label, nodeType }: NoteFormatMarkItemProps) => {
  const state = useMarkToolbarButtonState({ nodeType });
  const { props: buttonProps } = useMarkToolbarButton(state);

  return (
    <DropdownMenuItem
      onClick={() => {
        buttonProps.onClick();
      }}
    >
      {icon}
      {label}
    </DropdownMenuItem>
  );
};

export const NoteMoreFormatMenu = () => {
  const gt = useGT();
  const editor = useEditorRef();
  const linkState = useLinkToolbarButtonState();
  const { props: linkProps } = useLinkToolbarButton(linkState);

  return (
    <DropdownMenu>
      <NoteToolbarMenuTrigger tooltip={gt("More formatting")}>
        <EllipsisIcon />
      </NoteToolbarMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48" finalFocus={false}>
        <NoteFormatMarkItem
          icon={<StrikethroughIcon />}
          label={gt("Strikethrough")}
          nodeType={KEYS.strikethrough}
        />
        <NoteFormatMarkItem icon={<CodeIcon />} label={gt("Code")} nodeType={KEYS.code} />
        <DropdownMenuItem
          onClick={() => {
            linkProps.onClick();
          }}
        >
          <LinkIcon />
          {gt("Link")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            insertEquation(editor, { select: true });
            editor.tf.focus();
          }}
        >
          <SquareRadicalIcon />
          {gt("Equation")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            insertInlineEquation(editor, "", { select: true });
            editor.tf.focus();
          }}
        >
          <RadicalIcon />
          {gt("Inline equation")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            editor.tf.removeMarks();
            setBlockType(editor, KEYS.p);
            editor.tf.focus();
          }}
        >
          <RemoveFormattingIcon />
          {gt("Clear formatting")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const NoteListsMenu = () => {
  const gt = useGT();
  const editor = useEditorRef();
  const { props: indentProps } = useIndentButton();
  const { props: outdentProps } = useOutdentButton();
  const listStyle = useEditorSelector((editor) => {
    if (someList(editor, KEYS.listTodo)) {
      return KEYS.listTodo;
    }
    if (someList(editor, KEYS.ol)) {
      return KEYS.ol;
    }
    if (someList(editor, KEYS.ul)) {
      return KEYS.ul;
    }

    return null;
  }, []);

  const toggle = (listStyleType: string) => {
    toggleList(editor, { listStyleType });
    editor.tf.focus();
  };

  return (
    <DropdownMenu>
      <NoteToolbarMenuTrigger tooltip={gt("Lists")}>
        <ListIcon />
      </NoteToolbarMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48" finalFocus={false}>
        <DropdownMenuItem
          onClick={() => {
            toggle(KEYS.ul);
          }}
        >
          <ListIcon />
          {gt("Bulleted list")}
          {listStyle === KEYS.ul ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            toggle(KEYS.ol);
          }}
        >
          <ListOrderedIcon />
          {gt("Numbered list")}
          {listStyle === KEYS.ol ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            toggle(KEYS.listTodo);
          }}
        >
          <ListTodoIcon />
          {gt("To-do list")}
          {listStyle === KEYS.listTodo ? <span className="ml-auto text-xs">✓</span> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            outdentProps.onClick();
          }}
        >
          <OutdentIcon />
          {gt("Outdent")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            indentProps.onClick();
          }}
        >
          <IndentIcon />
          {gt("Indent")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const TABLE_PICKER_SIZE = 8;

const NoteTablePicker = ({ onInsert }: { onInsert: () => void }) => {
  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [size, setSize] = useState({ colCount: 0, rowCount: 0 });

  return (
    <button
      className="flex flex-col gap-2"
      onClick={() => {
        if (size.colCount === 0 || size.rowCount === 0) return;

        tf.insert.table(
          { colCount: size.colCount, header: true, rowCount: size.rowCount },
          { select: true },
        );
        editor.tf.focus();
        onInsert();
      }}
      type="button"
    >
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${TABLE_PICKER_SIZE}, 0.75rem)` }}
      >
        {Array.from({ length: TABLE_PICKER_SIZE }, (_, rowIndex) =>
          Array.from({ length: TABLE_PICKER_SIZE }, (_, colIndex) => {
            const active = rowIndex < size.rowCount && colIndex < size.colCount;

            return (
              <div
                className={cn(
                  "size-3 border border-solid bg-secondary",
                  active && "border-current bg-accent",
                )}
                key={`${rowIndex}-${colIndex}`}
                onMouseMove={() => {
                  setSize({ colCount: colIndex + 1, rowCount: rowIndex + 1 });
                }}
              />
            );
          }),
        )}
      </div>
      <div className="text-center text-xs text-muted-foreground">
        {size.rowCount} × {size.colCount}
      </div>
    </button>
  );
};

export const NoteTableMenu = () => {
  const gt = useGT();
  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [open, setOpen] = useState(false);
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: KEYS.table } }),
    [],
  );

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <NoteToolbarMenuTrigger tooltip={gt("Table")}>
        <TableIcon />
      </NoteToolbarMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48" finalFocus={false}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <TableIcon />
            {gt("Insert table")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-auto p-2" sideOffset={8}>
            <NoteTablePicker
              onInsert={() => {
                setOpen(false);
              }}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.insert.tableRow({ before: true });
            editor.tf.focus();
          }}
        >
          {gt("Insert row before")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.insert.tableRow();
            editor.tf.focus();
          }}
        >
          {gt("Insert row after")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.remove.tableRow();
            editor.tf.focus();
          }}
        >
          {gt("Delete row")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.insert.tableColumn({ before: true });
            editor.tf.focus();
          }}
        >
          {gt("Insert column before")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.insert.tableColumn();
            editor.tf.focus();
          }}
        >
          {gt("Insert column after")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.remove.tableColumn();
            editor.tf.focus();
          }}
        >
          {gt("Delete column")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!tableSelected}
          onClick={() => {
            tf.remove.table();
            editor.tf.focus();
          }}
        >
          {gt("Delete table")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
