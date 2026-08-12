import { getToolName, isToolUIPart } from "ai";

import { KnownToolName } from "@/lib/ai-sdk/known-tool-name";
import { isVisibleIntermediatePart } from "@/lib/ai-sdk/tool-parts";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";
import type {
  ThreadUIMessagePart,
  WorkEndPart,
} from "@/routes/_protected.chat.$threadId/-thread-types";

type TextPart = Extract<ThreadUIMessagePart, { type: "text" }>;

type AssistantMessageTextBlock = {
  type: "text";
  id: string;
  part: TextPart;
  index: number;
};

type AssistantMessageRunBlock = {
  type: "run";
  id: string;
  parts: ThreadUIMessagePart[];
  startIndex: number;
};

export type AssistantMessageBlock = AssistantMessageTextBlock | AssistantMessageRunBlock;

export const getWorkRunTiming = (parts: ThreadUIMessagePart[]) => {
  const start = parts.find((part) => part.type === "data-work-start");

  const end = parts.findLast(
    (part): part is WorkEndPart =>
      part.type === "data-work-end" && part.data.segmentId === start?.data.segmentId,
  );

  return {
    startedAt: start?.data.startedAt,
    completedAt: end?.data.completedAt,
    durationMs: end?.data.durationMs,
  };
};

export const groupAssistantParts = (parts: ThreadUIMessagePart[]): AssistantMessageBlock[] => {
  const blocks: AssistantMessageBlock[] = [];
  let index = 0;

  while (index < parts.length) {
    const part = parts[index];

    if (part.type === "text") {
      blocks.push({ type: "text", id: `text-${index}`, part, index });
      index += 1;
      continue;
    }

    const startIndex = index;
    const runParts: ThreadUIMessagePart[] = [];

    while (index < parts.length) {
      const runPart = parts[index];
      if (runPart.type === "text") break;

      runParts.push(runPart);
      index += 1;
    }

    if (runParts.some(isVisibleIntermediatePart)) {
      blocks.push({
        type: "run",
        id: `run-${startIndex}`,
        parts: runParts,
        startIndex,
      });
    }
  }

  return blocks;
};

export type WorkActivityKind = "default" | "research";

export const TOOL_WORK_ACTIVITY_KIND = {
  "agent-webResearch": "research",
  webSearch: "research",
  webFetch: "research",
  fileVectorSearch: "research",
  fileGraphRag: "research",
  getFile: "default",
  executeCode: "default",
  docs: "default",
  recall: "default",
} as const satisfies Record<MnemonicToolName, WorkActivityKind>;

export const getDominantWorkActivityKind = (parts: ThreadUIMessagePart[]): WorkActivityKind => {
  const counts = new Map<WorkActivityKind, number>();
  let totalToolCalls = 0;

  for (const part of parts) {
    if (!isToolUIPart(part)) {
      continue;
    }

    const toolName = getToolName(part);
    if (!KnownToolName.is(toolName)) {
      continue;
    }

    const kind = TOOL_WORK_ACTIVITY_KIND[toolName];
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    totalToolCalls += 1;
  }

  if (totalToolCalls === 0) {
    return "default";
  }

  let dominantKind: WorkActivityKind = "default";
  let dominantCount = 0;

  for (const [kind, count] of counts) {
    if (count > dominantCount) {
      dominantKind = kind;
      dominantCount = count;
    }
  }

  if (dominantKind === "default" || dominantCount <= totalToolCalls / 2) {
    return "default";
  }

  return dominantKind;
};
