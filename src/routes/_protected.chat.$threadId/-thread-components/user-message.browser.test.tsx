import { nanoid } from "nanoid";
import { assert, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import { useChatStore } from "@/routes/-chat-store";
import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { renderThreadBrowser } from "@/test/render-thread-browser";
import { waitForFrames } from "@/test/utils";

const MESSAGE_ID = nanoid();

const multilineMarkdown = Array.from(
  { length: 20 },
  (_, index) => `Line ${index + 1} of the user message`,
).join("\n");

const whitespaceMarkdown = [
  "Line one  with   spaced   words",
  "",
  "",
  "Line after blank lines",
  "	tabbed line",
].join("\n");

const userMessage = {
  id: MESSAGE_ID,
  role: "user",
  parts: [{ type: "text", text: multilineMarkdown }],
} as ThreadUIMessage;

const whitespaceUserMessage = {
  id: MESSAGE_ID,
  role: "user",
  parts: [{ type: "text", text: whitespaceMarkdown }],
} as ThreadUIMessage;

const getClampRoot = () => {
  const root = document.querySelector<HTMLElement>('[data-test-id="user-message-clamp"]');
  assert(root, "Expected clamp root");

  return root;
};

const getFirstTextTop = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode();
  assert(textNode?.parentElement, "Expected user message text node");

  return textNode.parentElement.getBoundingClientRect().top;
};

const getEditComposerRoot = () =>
  document.querySelector<HTMLElement>(
    '[data-test-id="thread-composer-edit"] [data-test-id="thread-composer-editor"]',
  );

const getEditModelTrigger = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-test-id="thread-composer-edit"] [data-test-id="model-picker-trigger"]',
  );

describe("UserMessage browser", () => {
  it("clamps with the computed typeset line-height and keeps text top on edit", async () => {
    await renderThreadBrowser([userMessage]);

    await expect.element(page.getByText("Line 1 of the user message")).toBeVisible();
    await waitForFrames();

    const clampRoot = getClampRoot();
    const clampContent = document.querySelector<HTMLElement>(
      '[data-test-id="user-message-clamp-content"]',
    );
    assert(clampContent, "Expected clamp content");

    const computedLineHeight = Number.parseFloat(getComputedStyle(clampRoot).lineHeight);
    const hookLineHeight = Number.parseFloat(clampRoot.style.lineHeight);

    expect(computedLineHeight).toBeGreaterThan(0);
    expect(hookLineHeight).toBeCloseTo(computedLineHeight, 1);

    const maxHeightPx = Number.parseFloat(clampContent.style.maxHeight);
    expect(maxHeightPx).toBeCloseTo(8 * computedLineHeight, 1);
    expect(clampContent.clientHeight).toBeCloseTo(8 * computedLineHeight, 1);
    expect(clampContent.scrollHeight).toBeGreaterThan(clampContent.clientHeight + 1);

    const textTopBefore = getFirstTextTop(clampRoot);

    await userEvent.click(page.getByText("Line 1 of the user message"));

    await expect.element(page.getByText("Line 1 of the user message")).toBeVisible();

    const editRoot = getEditComposerRoot();
    assert(editRoot, "Expected edit composer");

    expect(useChatStore.getState().editingState?.messageId).toBe(MESSAGE_ID);
    expect(getEditModelTrigger()).toBeTruthy();

    const textTopAfter = getFirstTextTop(editRoot);
    expect(Math.abs(textTopAfter - textTopBefore)).toBeLessThanOrEqual(1);
  });

  it("keeps edit state when changing the model from the picker", async () => {
    await renderThreadBrowser([userMessage]);

    await expect.element(page.getByText("Line 1 of the user message")).toBeVisible();
    await userEvent.click(page.getByText("Line 1 of the user message"));

    expect(useChatStore.getState().editingState?.messageId).toBe(MESSAGE_ID);

    const modelTrigger = getEditModelTrigger();
    assert(modelTrigger, "Expected edit model trigger");

    await userEvent.click(page.elementLocator(modelTrigger));
    await expect.element(page.getByText("Analysis")).toBeVisible();

    const analysisItem = document.querySelector<HTMLElement>(
      '[data-test-id="model-option-analysis"]',
    );
    assert(analysisItem, "Expected the analysis model option");

    await userEvent.click(page.elementLocator(analysisItem));

    expect(useChatStore.getState().editingState?.messageId).toBe(MESSAGE_ID);
  });

  it("keeps the same whitespace behavior when entering edit", async () => {
    await renderThreadBrowser([whitespaceUserMessage]);

    await expect.element(page.getByText(/Line one  with   spaced   words/)).toBeVisible();
    await waitForFrames();

    const clampRoot = getClampRoot();
    const displayText = clampRoot.querySelector<HTMLElement>(
      '[data-test-id="user-message-clamp-content"] > *',
    );
    assert(displayText, "Expected display message text root");

    expect(getComputedStyle(displayText).whiteSpace).toMatch(/pre-wrap/);

    const textTopBefore = getFirstTextTop(clampRoot);
    const blankLineTopBefore = page
      .getByText("Line after blank lines")
      .element()
      .getBoundingClientRect().top;

    await userEvent.click(page.getByText(/Line one  with   spaced   words/));

    const editRoot = getEditComposerRoot();
    assert(editRoot, "Expected edit composer");

    expect(getComputedStyle(editRoot).whiteSpace).toMatch(/pre-wrap/);
    expect(Math.abs(getFirstTextTop(editRoot) - textTopBefore)).toBeLessThanOrEqual(1);

    const blankLineTopAfter = page
      .getByText("Line after blank lines")
      .element()
      .getBoundingClientRect().top;
    expect(Math.abs(blankLineTopAfter - blankLineTopBefore)).toBeLessThanOrEqual(1);
  });
});
