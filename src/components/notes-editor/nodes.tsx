import { isOrderedList } from "@platejs/list";
import { useTodoListElement, useTodoListElementState } from "@platejs/list/react";
import { KEYS } from "platejs";
import type { PlateElementProps, RenderNodeWrapper } from "platejs/react";
import { PlateElement, useReadOnly } from "platejs/react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const NoteBlockquoteElement = (props: PlateElementProps) => (
  <PlateElement as="blockquote" {...props} />
);

export const NoteCodeBlockElement = (props: PlateElementProps) => (
  <PlateElement as="pre" {...props}>
    <code>{props.children}</code>
  </PlateElement>
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

/** Lists are indent-based: each list item is its own block, wrapped in an `ol`/`ul` on render. */
export const NoteBlockList: RenderNodeWrapper = (props) => {
  if (typeof props.element.listStyleType !== "string") return;

  return (listProps) => <NoteList {...listProps} />;
};

const NoteList = (props: PlateElementProps) => {
  const { listStart, listStyleType } = props.element;
  const List = isOrderedList(props.element) ? "ol" : "ul";
  const isTodo = listStyleType === KEYS.listTodo;

  return (
    <List
      className="relative m-0 p-0"
      start={typeof listStart === "number" ? listStart : undefined}
      style={{ listStyleType: typeof listStyleType === "string" ? listStyleType : undefined }}
    >
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
