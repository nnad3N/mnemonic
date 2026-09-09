import { isOrderedList } from "@platejs/list";
import { useTodoListElement, useTodoListElementState } from "@platejs/list/react";
import { useEquationElement } from "@platejs/math/react";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-tanstack-start";
import { RadicalIcon } from "lucide-react";
import { useTheme } from "next-themes";
import type { TCodeBlockElement, TEquationElement } from "platejs";
import { KEYS, NodeApi } from "platejs";
import type { PlateElementProps, PlateLeafProps, RenderNodeWrapper } from "platejs/react";
import {
  PlateElement,
  PlateLeaf,
  useEditorRef,
  useFocused,
  useHotkeys,
  useReadOnly,
  useSelected,
} from "platejs/react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { getListProps } from "./block-type";
import { NoteEquationTexEditor } from "./equation-input";

export const NoteBlockquoteElement = (props: PlateElementProps) => (
  <PlateElement as="blockquote" {...props} />
);

export const NoteHorizontalRuleElement = (props: PlateElementProps) => (
  <PlateElement {...props}>
    <div contentEditable={false}>
      <hr />
    </div>
    {props.children}
  </PlateElement>
);

export const NoteLinkElement = (props: PlateElementProps) => (
  <PlateElement
    {...props}
    as="a"
    attributes={{ ...props.attributes, href: String(props.element.url) }}
  />
);

export const NoteTableElement = (props: PlateElementProps) => (
  <div className="typeset-scroll">
    <PlateElement as="table" {...props}>
      <tbody>{props.children}</tbody>
    </PlateElement>
  </div>
);

export const NoteTableRowElement = (props: PlateElementProps) => (
  <PlateElement as="tr" {...props} />
);

export const NoteTableCellElement = (props: PlateElementProps) => (
  <PlateElement as="td" {...props} />
);

export const NoteTableCellHeaderElement = (props: PlateElementProps) => (
  <PlateElement as="th" {...props} />
);

const katexOptions = {
  errorColor: "#cc0000",
  fleqn: false,
  leqno: false,
  output: "htmlAndMathml" as const,
  strict: "warn" as const,
  throwOnError: false,
  trust: false,
};

type NoteEquationPopoverProps = {
  isInline: boolean;
  open: boolean;
  placeholder: string;
  setOpen: (open: boolean) => void;
};

const NoteEquationPopover = ({
  isInline,
  open,
  placeholder,
  setOpen,
}: NoteEquationPopoverProps) => {
  const readOnly = useReadOnly();

  if (readOnly) {
    return null;
  }

  return (
    <PopoverContent align="start" className="w-80 p-2" finalFocus={false} initialFocus={false}>
      <NoteEquationTexEditor
        isInline={isInline}
        open={open}
        placeholder={placeholder}
        setOpen={setOpen}
      />
    </PopoverContent>
  );
};

export const NoteEquationElement = (props: PlateElementProps<TEquationElement>) => {
  const gt = useGT();
  const selected = useSelected();
  const focused = useFocused();
  const [open, setOpen] = useState(selected);
  const katexRef = useRef<HTMLDivElement | null>(null);

  useHotkeys(
    "enter",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    },
    { enabled: selected && focused && !open, enableOnContentEditable: true },
    [selected, focused, open],
  );

  useEquationElement({
    element: props.element,
    katexRef,
    options: { ...katexOptions, displayMode: true },
  });

  return (
    <PlateElement className="my-1" {...props}>
      <Popover modal={false} onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <button
              className={cn(
                "group flex w-full cursor-pointer items-center justify-center rounded-sm select-none hover:bg-primary/10 data-[selected=true]:bg-primary/10",
                props.element.texExpression.length === 0 ? "bg-muted p-3" : "px-2 py-1",
              )}
              contentEditable={false}
              data-selected={selected}
              type="button"
            />
          }
        >
          {props.element.texExpression.length > 0 ? (
            <span ref={katexRef} />
          ) : (
            <span className="flex h-7 w-full items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
              <RadicalIcon className="size-5 text-muted-foreground/80" />
              <T>Add equation</T>
            </span>
          )}
        </PopoverTrigger>
        <NoteEquationPopover
          isInline={false}
          open={open}
          placeholder={gt("TeX equation")}
          setOpen={setOpen}
        />
      </Popover>
      {props.children}
    </PlateElement>
  );
};

export const NoteInlineEquationElement = (props: PlateElementProps<TEquationElement>) => {
  const gt = useGT();
  const selected = useSelected();
  const focused = useFocused();
  const [open, setOpen] = useState(selected);
  const katexRef = useRef<HTMLDivElement | null>(null);

  useHotkeys(
    "enter",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    },
    { enabled: selected && focused && !open, enableOnContentEditable: true },
    [selected, focused, open],
  );

  useEquationElement({
    element: props.element,
    katexRef,
    options: { ...katexOptions, displayMode: false },
  });

  return (
    <PlateElement {...props} as="span" className="inline-block align-baseline">
      <Popover modal={false} onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <button
              className={cn(
                "inline-flex cursor-pointer items-center rounded-sm px-1 select-none hover:bg-primary/10 data-[selected=true]:bg-primary/10",
                props.element.texExpression.length === 0 && "bg-muted text-muted-foreground",
              )}
              contentEditable={false}
              data-selected={selected}
              type="button"
            />
          }
        >
          {props.element.texExpression.length > 0 ? (
            <span ref={katexRef} />
          ) : (
            <RadicalIcon className="size-4" />
          )}
        </PopoverTrigger>
        <NoteEquationPopover
          isInline
          open={open}
          placeholder={gt("TeX equation")}
          setOpen={setOpen}
        />
      </Popover>
      {props.children}
    </PlateElement>
  );
};

const CODE_LANGUAGES = [
  { label: "Plain text", value: "plaintext" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "TSX", value: "tsx" },
  { label: "Python", value: "python" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
  { label: "JSON", value: "json" },
  { label: "Bash", value: "bash" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "Markdown", value: "markdown" },
  { label: "SQL", value: "sql" },
  { label: "YAML", value: "yaml" },
  { label: "Mermaid", value: "mermaid" },
] as const;

const mermaidPlugin = createMermaidPlugin();

const hashMermaidSource = (source: string) => {
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
};

const NoteMermaidPreview = ({ source }: { source: string }) => {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "default";
  const svg = useQuery({
    queryFn: async () => {
      const mermaid = mermaidPlugin.getMermaid({ theme });
      const result = await mermaid.render(
        `note-mermaid-${crypto.randomUUID().replaceAll("-", "")}`,
        source,
      );

      return result.svg;
    },
    queryKey: ["note-mermaid", hashMermaidSource(source), theme],
    retry: false,
    staleTime: Infinity,
  });

  if (!svg.data) return;

  return (
    <div
      className="overflow-x-auto py-2 [&_svg]:mx-auto"
      // Mermaid returns SVG markup from its own renderer.
      dangerouslySetInnerHTML={{ __html: svg.data }}
    />
  );
};

const NoteCodeLanguageMenu = ({ element }: { element: TCodeBlockElement }) => {
  const gt = useGT();
  const editor = useEditorRef();
  const readOnly = useReadOnly();
  const value = element.lang || "plaintext";
  const selected = CODE_LANGUAGES.find((language) => language.value === value)?.label ?? value;

  if (readOnly) {
    return <span className="px-2 text-xs text-muted-foreground">{selected}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button className="h-6 px-2 text-xs text-muted-foreground" size="sm" variant="ghost" />
        }
      >
        {selected}
        <span className="sr-only">{gt("Language")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36" finalFocus={false}>
        <DropdownMenuRadioGroup
          onValueChange={(lang) => {
            editor.tf.setNodes<TCodeBlockElement>({ lang }, { at: element });
          }}
          value={value}
        >
          {CODE_LANGUAGES.map((language) => (
            <DropdownMenuRadioItem key={language.value} value={language.value}>
              {language.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const NoteCodeBlockElement = (props: PlateElementProps<TCodeBlockElement>) => {
  const selected = useSelected();
  const focused = useFocused();
  const lang = props.element.lang || "plaintext";
  const isMermaid = lang === "mermaid";
  const showMermaidPreview = isMermaid && !(selected && focused);
  const source = props.element.children.map((line) => NodeApi.string(line)).join("\n");

  return (
    <PlateElement className="group/code relative" {...props}>
      <div className="absolute top-1 right-1 z-10" contentEditable={false}>
        <NoteCodeLanguageMenu element={props.element} />
      </div>
      {showMermaidPreview ? (
        <div contentEditable={false}>
          <NoteMermaidPreview source={source} />
        </div>
      ) : null}
      <pre className={cn(showMermaidPreview && "sr-only")}>
        <code>{props.children}</code>
      </pre>
    </PlateElement>
  );
};

export const NoteCodeLineElement = (props: PlateElementProps) => <PlateElement {...props} />;

export const NoteCodeSyntaxLeaf = (props: PlateLeafProps) => {
  // SAFETY: CodeSyntaxPlugin writes className onto the leaf for each token span.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const tokenClassName = props.leaf.className as string | undefined;

  return <PlateLeaf className={tokenClassName} {...props} />;
};

export const NoteBlockList: RenderNodeWrapper = (props) => {
  if (!getListProps(props.element).listStyleType) return;

  return (listProps) => <NoteList {...listProps} />;
};

const NoteList = (props: PlateElementProps) => {
  const { listStart, listStyleType } = getListProps(props.element);
  const List = isOrderedList(props.element) ? "ol" : "ul";
  const isTodo = listStyleType === KEYS.listTodo;

  return (
    <List className="relative m-0 p-0" start={listStart} style={{ listStyleType }}>
      {isTodo ? (
        <>
          <NoteTodoMarker {...props} />
          <li className={cn("list-none", props.element.checked === true && "line-through")}>
            {props.children}
          </li>
        </>
      ) : (
        <li>{props.children}</li>
      )}
    </List>
  );
};

const NoteTodoMarker = (props: PlateElementProps) => {
  const state = useTodoListElementState({ element: props.element });
  const { checkboxProps } = useTodoListElement(state);
  const readOnly = useReadOnly();

  return (
    <div contentEditable={false}>
      <Checkbox
        className={cn("absolute top-1.5 -left-6", readOnly && "pointer-events-none")}
        {...checkboxProps}
      />
    </div>
  );
};
