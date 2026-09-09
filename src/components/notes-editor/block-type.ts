import { isOrderedList, toggleList, toggleListByPathUnSet } from "@platejs/list";
import type { Descendant, TElement } from "platejs";
import { ElementApi, KEYS } from "platejs";
import type { PlateEditor } from "platejs/react";
import * as v from "valibot";

const listStyleTypes: string[] = [KEYS.ul, KEYS.ol, KEYS.listTodo];

const listPropsSchema = v.object({
  listStart: v.fallback(v.optional(v.number()), undefined),
  listStyleType: v.fallback(v.optional(v.string()), undefined),
});

export const getListProps = (element: TElement) => v.parse(listPropsSchema, element);

export const getBlockType = (block: Descendant) => {
  if (!ElementApi.isElement(block)) {
    return KEYS.p;
  }

  const { listStyleType } = getListProps(block);

  if (listStyleType) {
    if (listStyleType === KEYS.listTodo) {
      return KEYS.listTodo;
    }

    return isOrderedList(block) ? KEYS.ol : KEYS.ul;
  }

  return block.type === KEYS.codeLine ? KEYS.codeBlock : block.type;
};

export const setBlockType = (editor: PlateEditor, type: string) => {
  editor.tf.withoutNormalizing(() => {
    if (listStyleTypes.includes(type)) {
      toggleList(editor, { listStyleType: type });
      return;
    }

    for (const entry of editor.api.blocks({ mode: "lowest" })) {
      if (getListProps(entry[0]).listStyleType) {
        toggleListByPathUnSet(editor, entry);
      }

      editor.tf.setNodes({ type }, { at: entry[1] });
    }
  });
};
