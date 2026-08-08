import { fireEvent, render, screen } from "@testing-library/react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { describe, expect, it, vi } from "vitest";

import { threadEditorPlugins } from "../plate";
import { ThreadComposerKeyboardPlugin } from "./keyboard";

type ComposerHandlers = {
  onEnter?: () => void;
  onEscape?: () => void;
  onStopStream?: () => void;
};

const ComposerHarness = ({ onEnter, onEscape, onStopStream }: ComposerHandlers) => {
  const editor = usePlateEditor({
    id: "keyboard-test-editor",
    plugins: threadEditorPlugins,
    value: [{ type: "p", children: [{ text: "draft" }] }],
  });

  editor.setOption(ThreadComposerKeyboardPlugin, "onEnter", onEnter);
  editor.setOption(ThreadComposerKeyboardPlugin, "onEscape", onEscape);
  editor.setOption(ThreadComposerKeyboardPlugin, "onStopStream", onStopStream);

  return (
    <Plate editor={editor}>
      <PlateContent />
    </Plate>
  );
};

const mountComposer = (handlers: ComposerHandlers = {}) => {
  render(<ComposerHarness {...handlers} />);

  return screen.getByRole("textbox");
};

describe("ThreadComposerKeyboardPlugin", () => {
  it("sends the message on Enter and prevents the newline", () => {
    const onEnter = vi.fn<() => void>();
    const content = mountComposer({ onEnter });

    const handled = fireEvent.keyDown(content, { key: "Enter" });

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(handled).toBe(false);
  });

  it("lets Shift+Enter through so it inserts a newline", () => {
    const onEnter = vi.fn<() => void>();
    const content = mountComposer({ onEnter });

    fireEvent.keyDown(content, { key: "Enter", shiftKey: true });

    expect(onEnter).not.toHaveBeenCalled();
  });

  it("cancels editing on Escape", () => {
    const onEscape = vi.fn<() => void>();
    const content = mountComposer({ onEscape });

    fireEvent.keyDown(content, { key: "Escape" });

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("stops the stream on Ctrl+Shift+Backspace and on the Meta variant", () => {
    const onStopStream = vi.fn<() => void>();
    const content = mountComposer({ onStopStream });

    fireEvent.keyDown(content, { key: "Backspace", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(content, { key: "Backspace", metaKey: true, shiftKey: true });

    expect(onStopStream).toHaveBeenCalledTimes(2);
  });

  it("leaves plain and unshifted Backspace to the editor", () => {
    const onStopStream = vi.fn<() => void>();
    const content = mountComposer({ onStopStream });

    fireEvent.keyDown(content, { key: "Backspace" });
    fireEvent.keyDown(content, { key: "Backspace", ctrlKey: true });

    expect(onStopStream).not.toHaveBeenCalled();
  });

  it("does nothing when the composer has no handlers wired", () => {
    const content = mountComposer();

    expect(fireEvent.keyDown(content, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(content, { key: "Escape" })).toBe(true);
  });
});
