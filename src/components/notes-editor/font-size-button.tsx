import { toUnitLess } from "@platejs/basic-styles";
import { FontSizePlugin } from "@platejs/basic-styles/react";
import { T, useGT } from "gt-tanstack-start";
import { MinusIcon, PlusIcon } from "lucide-react";
import { KEYS } from "platejs";
import { useEditorPlugin, useEditorSelector } from "platejs/react";
import { useId, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { NoteToolbarButton } from "./toolbar-buttons";

const DEFAULT_FONT_SIZE = "14";

const headingFontSizes: Record<string, string> = {
  [KEYS.h1]: "24",
  [KEYS.h2]: "18",
  [KEYS.h3]: "16",
};

const fontSizes = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "48"];

export const NoteFontSizeButton = () => {
  const gt = useGT();
  const { editor, tf } = useEditorPlugin(FontSizePlugin);
  const inputId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const selectionFontSize = useEditorSelector((editor) => {
    const mark = editor.api.marks()?.[KEYS.fontSize];

    if (typeof mark === "string") return toUnitLess(mark);

    const block = editor.api.block();

    if (!block) return DEFAULT_FONT_SIZE;

    return headingFontSizes[block[0].type] ?? DEFAULT_FONT_SIZE;
  }, []);
  const value = draft ?? selectionFontSize;

  const setFontSize = (size: string) => {
    const parsed = Number.parseInt(toUnitLess(size), 10);

    if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) return;

    tf.fontSize.addMark(`${parsed}px`);
  };

  return (
    <div className="flex items-center">
      <NoteToolbarButton
        onClick={() => {
          setFontSize(String(Number(value) - 1));
          editor.tf.focus();
        }}
        tooltip={gt("Decrease font size")}
      >
        <MinusIcon />
      </NoteToolbarButton>
      <label className="sr-only" htmlFor={inputId}>
        <T>Font size</T>
      </label>
      <Popover open={draft !== null}>
        <PopoverTrigger
          nativeButton={false}
          render={
            <input
              className="h-7 w-10 rounded-lg bg-transparent text-center text-sm outline-none hover:bg-muted"
              data-plate-focus="true"
              id={inputId}
              onBlur={() => {
                if (draft === null) return;

                setFontSize(draft);
                setDraft(null);
              }}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              onFocus={() => {
                setDraft(selectionFontSize);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || draft === null) return;

                event.preventDefault();
                setFontSize(draft);
                setDraft(null);
                editor.tf.focus();
              }}
              value={value}
            />
          }
        />
        <PopoverContent className="w-12 p-1" finalFocus={false} initialFocus={false}>
          {fontSizes.map((size) => (
            <button
              className="flex h-7 w-full items-center justify-center rounded-lg text-sm hover:bg-accent aria-pressed:bg-muted"
              aria-pressed={size === value}
              key={size}
              onClick={() => {
                setFontSize(size);
                setDraft(null);
                editor.tf.focus();
              }}
              // Keeps the input focused, so its blur does not close the popup before the click.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              type="button"
            >
              {size}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <NoteToolbarButton
        onClick={() => {
          setFontSize(String(Number(value) + 1));
          editor.tf.focus();
        }}
        tooltip={gt("Increase font size")}
      >
        <PlusIcon />
      </NoteToolbarButton>
    </div>
  );
};
