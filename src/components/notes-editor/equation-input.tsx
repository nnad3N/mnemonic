import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from "@platejs/code-block/react";
import latex from "highlight.js/lib/languages/latex";
import { createLowlight } from "lowlight";
import type { TCodeBlockElement, TEquationElement, Value } from "platejs";
import { isHotkey, KEYS, NodeApi } from "platejs";
import type { PlateElementProps, PlateLeafProps } from "platejs/react";
import {
  Plate,
  PlateContent,
  PlateElement,
  PlateLeaf,
  useEditorRef,
  useElement,
  usePlateEditor,
} from "platejs/react";
import { useEffect, useId, useRef } from "react";

const lowlight = createLowlight();
lowlight.register("latex", latex);

const EquationCodeBlockElement = (props: PlateElementProps<TCodeBlockElement>) => (
  <PlateElement as="pre" className="m-0 bg-transparent p-0 font-mono text-sm" {...props}>
    <code>{props.children}</code>
  </PlateElement>
);

const EquationCodeLineElement = (props: PlateElementProps) => <PlateElement {...props} />;

const EquationCodeSyntaxLeaf = (props: PlateLeafProps) => {
  // SAFETY: CodeSyntaxPlugin writes className onto the leaf for each token span.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const tokenClassName = props.leaf.className as string | undefined;

  return <PlateLeaf className={tokenClassName} {...props} />;
};

const equationInputPlugins = [
  CodeBlockPlugin.configure({
    node: { component: EquationCodeBlockElement },
    options: { lowlight },
  }),
  CodeLinePlugin.withComponent(EquationCodeLineElement),
  CodeSyntaxPlugin.withComponent(EquationCodeSyntaxLeaf),
];

const texToValue = (tex: string): Value => [
  {
    children: tex.split("\n").map((line) => ({
      children: [{ text: line }],
      type: KEYS.codeLine,
    })),
    lang: "latex",
    type: KEYS.codeBlock,
  },
];

type NoteEquationTexEditorProps = {
  isInline: boolean;
  placeholder: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export const NoteEquationTexEditor = ({
  isInline,
  open,
  placeholder,
  setOpen,
}: NoteEquationTexEditorProps) => {
  const parentEditor = useEditorRef();
  const element = useElement<TEquationElement>();
  const editorId = useId();
  const initialExpressionRef = useRef(element.texExpression);
  const editor = usePlateEditor({
    id: `equation-tex-${editorId}`,
    plugins: equationInputPlugins,
    value: texToValue(element.texExpression),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    editor.tf.focus({ edge: "endEditor" });
  }, [editor, open]);

  return (
    <Plate
      editor={editor}
      onValueChange={() => {
        const block = editor.children[0];
        const texExpression = block.children.map((line) => NodeApi.string(line)).join("\n");
        const setExpression = () => {
          parentEditor.tf.setNodes({ texExpression }, { at: element });
        };

        if (isInline) {
          parentEditor.tf.withMerging(setExpression);
        } else {
          setExpression();
        }
      }}
    >
      <PlateContent
        className="w-full rounded-xl bg-transparent px-2 py-1.5 font-mono text-sm outline-none"
        onKeyDown={(event) => {
          if (isHotkey("escape", event) === false) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();

          if (isInline) {
            parentEditor.tf.setNodes(
              { texExpression: initialExpressionRef.current },
              { at: element },
            );
          }

          setOpen(false);
          parentEditor.tf.select(element, { focus: true, next: true });
        }}
        onMouseDown={() => {
          setOpen(true);
        }}
        placeholder={placeholder}
      />
    </Plate>
  );
};
