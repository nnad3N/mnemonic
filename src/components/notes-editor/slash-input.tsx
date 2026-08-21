import { T, useGT } from "gt-tanstack-start";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
} from "lucide-react";
import type { TComboboxInputElement } from "platejs";
import { KEYS } from "platejs";
import type { PlateEditor, PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/plate/autocomplete";
import { matchesQuery } from "@/lib/string-match";

import { setBlockType } from "./block-type";

type SlashItem = {
  icon: ReactNode;
  label: string;
  onSelect: (editor: PlateEditor) => void;
  value: string;
};

export const NoteSlashInputElement = (props: PlateElementProps<TComboboxInputElement>) => {
  const gt = useGT();
  const [search, setSearch] = useState("");

  const blockItems: SlashItem[] = [
    { icon: <PilcrowIcon />, label: gt("Text"), value: KEYS.p },
    { icon: <Heading1Icon />, label: gt("Heading 1"), value: KEYS.h1 },
    { icon: <Heading2Icon />, label: gt("Heading 2"), value: KEYS.h2 },
    { icon: <Heading3Icon />, label: gt("Heading 3"), value: KEYS.h3 },
    { icon: <ListIcon />, label: gt("Bulleted list"), value: KEYS.ul },
    { icon: <ListOrderedIcon />, label: gt("Numbered list"), value: KEYS.ol },
    { icon: <ListTodoIcon />, label: gt("To-do list"), value: KEYS.listTodo },
    { icon: <QuoteIcon />, label: gt("Quote"), value: KEYS.blockquote },
    { icon: <SquareCodeIcon />, label: gt("Code block"), value: KEYS.codeBlock },
  ].map((item) => ({
    ...item,
    onSelect: (editor) => {
      setBlockType(editor, item.value);
    },
  }));

  const items = [
    ...blockItems,
    {
      icon: <MinusIcon />,
      label: gt("Divider"),
      value: KEYS.hr,
      onSelect: (editor: PlateEditor) => {
        editor.tf.insertNodes({ children: [{ text: "" }], type: KEYS.hr });
      },
    },
  ].filter((item) => matchesQuery(item.label, search));

  return (
    <PlateElement as="span" {...props}>
      <Autocomplete
        element={props.element}
        items={items}
        setValue={setSearch}
        trigger="/"
        value={search}
      >
        <AutocompleteInput />
        <AutocompleteContent>
          <AutocompleteEmpty>
            <T>No results</T>
          </AutocompleteEmpty>
          <AutocompleteList>
            {(item: SlashItem) => (
              <AutocompleteItem
                key={item.value}
                onClick={() => {
                  item.onSelect(props.editor);
                }}
                value={item}
              >
                {item.icon}
                {item.label}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
      {props.children}
    </PlateElement>
  );
};
