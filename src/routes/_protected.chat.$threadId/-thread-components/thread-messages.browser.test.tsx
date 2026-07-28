import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";

import type { ThreadUIMessage } from "@/routes/_protected.chat.$threadId/-thread-types";
import { renderThreadBrowser } from "@/test/render-thread-browser";
import { waitForFrames } from "@/test/utils";

/** Tall enough that ~10 messages overflow several viewports. */
const LONG_MESSAGE_PARAGRAPHS = 40;
const LONG_THREAD_MESSAGE_COUNT = 10;
const POST_READY_OBSERVE_FRAMES = 12;

const tallParagraph = (label: string, paragraphCount = LONG_MESSAGE_PARAGRAPHS) =>
  Array.from({ length: paragraphCount }, (_, index) =>
    `${label} paragraph ${index + 1}.`.repeat(3),
  ).join("\n\n");

const clampedUserMarkdown = Array.from(
  { length: 20 },
  (_, index) => `Clamped user line ${index + 1}`,
).join("\n");

const createMessages = (
  count: number,
  userText: (label: string) => string = tallParagraph,
): ThreadUIMessage[] =>
  Array.from({ length: count }, (_, index) => {
    const isUser = index % 2 === 0;

    return {
      id: nanoid(),
      role: isUser ? "user" : "assistant",
      parts: [
        {
          type: "text",
          text: isUser ? userText(`User ${index}`) : tallParagraph(`Assistant ${index}`),
        },
      ],
    } as ThreadUIMessage;
  });

const getViewport = () => {
  const viewport = document.querySelector<HTMLElement>(
    '[data-test-id="message-scroller-viewport"]',
  );

  if (!viewport) {
    throw new Error("Expected message scroller viewport");
  }

  return viewport;
};

const getLayoutContent = () => {
  const content = document.querySelector<HTMLElement>("[data-test-layout-ready]");

  if (!content) {
    throw new Error("Expected message scroller content");
  }

  return content;
};

const getMessageRows = () =>
  [...document.querySelectorAll<HTMLElement>("[data-test-index]")].sort(
    (a, b) => Number(a.dataset.testIndex) - Number(b.dataset.testIndex),
  );

const isPinnedToBottom = (viewport: HTMLElement) => {
  const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
  if (maxScrollTop <= viewport.clientHeight) {
    return false;
  }

  if (viewport.scrollTop < maxScrollTop - 2 || viewport.scrollTop > maxScrollTop + 1) {
    return false;
  }

  const rows = getMessageRows();
  const lastRow = rows.at(-1);
  if (!lastRow) {
    return false;
  }

  const content = getLayoutContent();
  const paddingBottom = Number.parseFloat(getComputedStyle(content).paddingBottom);
  const lastBottom = lastRow.getBoundingClientRect().bottom;
  const viewportBottom = viewport.getBoundingClientRect().bottom;
  if (Math.abs(lastBottom - (viewportBottom - paddingBottom)) >= 48) {
    return false;
  }

  const viewportTop = viewport.getBoundingClientRect().top;
  const firstVisible = rows.find((row) => row.getBoundingClientRect().bottom > viewportTop + 1);
  if (!firstVisible || Number(firstVisible.dataset.testIndex) <= 0) {
    return false;
  }

  return true;
};

/**
 * Wait until the thread has revealed (`opacity-100` after `transition-opacity`).
 * Asserting before this hides mid-settle shift behind `opacity-0`.
 */
const waitForOpacityTransitionComplete = async () => {
  await expect
    .poll(() => document.querySelector('[data-test-layout-ready="true"]'), { timeout: 15_000 })
    .not.toBeNull();

  await expect
    .poll(() => Number.parseFloat(getComputedStyle(getLayoutContent()).opacity), {
      timeout: 5_000,
    })
    .toBe(1);
};

/** After reveal: pinned to bottom, then stable across the next frames. */
const assertPinnedBottomWithoutShiftAfterReveal = async () => {
  await waitForOpacityTransitionComplete();
  await assertPinnedBottomWithoutShift();
};

const assertPinnedBottomWithoutShift = async () => {
  const viewport = getViewport();
  expect(isPinnedToBottom(viewport)).toBe(true);

  const rows = getMessageRows();
  const lastRow = rows.at(-1);
  if (!lastRow) {
    throw new Error("Expected last message row");
  }

  const scrollTopBefore = viewport.scrollTop;
  const lastTopBefore = lastRow.getBoundingClientRect().top;

  for (let frame = 0; frame < POST_READY_OBSERVE_FRAMES; frame += 1) {
    await waitForFrames(1);
    expect(isPinnedToBottom(viewport)).toBe(true);
    expect(Math.abs(viewport.scrollTop - scrollTopBefore)).toBeLessThanOrEqual(1);
    expect(Math.abs(lastRow.getBoundingClientRect().top - lastTopBefore)).toBeLessThanOrEqual(1);
  }
};

describe("ThreadMessages browser", () => {
  it("opens a long thread at the bottom without layout shift", async () => {
    await renderThreadBrowser(createMessages(LONG_THREAD_MESSAGE_COUNT));
    await assertPinnedBottomWithoutShiftAfterReveal();
  });

  it("opens a long thread with height-clamped user messages without layout shift", async () => {
    const messages = createMessages(LONG_THREAD_MESSAGE_COUNT, () => clampedUserMarkdown);
    messages.push({
      id: nanoid(),
      role: "user",
      parts: [{ type: "text", text: clampedUserMarkdown }],
    } as ThreadUIMessage);

    await renderThreadBrowser(messages);
    await waitForOpacityTransitionComplete();

    const clampRoot = document.querySelector<HTMLElement>('[data-test-id="user-message-clamp"]');
    const clampContent = document.querySelector<HTMLElement>(
      '[data-test-id="user-message-clamp-content"]',
    );

    if (!clampRoot || !clampContent) {
      throw new Error("Expected clamped user message at the bottom of the thread");
    }

    const lineHeight = Number.parseFloat(getComputedStyle(clampRoot).lineHeight);
    expect(clampContent.clientHeight).toBeCloseTo(8 * lineHeight, 1);
    expect(clampContent.scrollHeight).toBeGreaterThan(clampContent.clientHeight + 1);

    await assertPinnedBottomWithoutShift();
  });
});
