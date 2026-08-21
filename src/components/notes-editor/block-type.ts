import { isOrderedList, toggleList, toggleListByPathUnSet } from "@platejs/list";
import type { Descendant } from "platejs";
import { ElementApi, KEYS } from "platejs";
import type { PlateEditor } from "platejs/react";

const listStyleTypes: string[] = [KEYS.ul, KEYS.ol, KEYS.listTodo];

export const getBlockType = (block: Descendant) => {
  if (!ElementApi.isElement(block)) return KEYS.p;

  const listStyleType = block.listStyleType;

  if (typeof listStyleType === "string") {
    if (listStyleType === KEYS.listTodo) return KEYS.listTodo;

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
      if (typeof entry[0].listStyleType === "string") {
        toggleListByPathUnSet(editor, entry);
      }

      editor.tf.setNodes({ type }, { at: entry[1] });
    }
  });
};
