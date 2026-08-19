import { getToolName, isToolUIPart } from "ai";

import { KnownToolName } from "@/lib/ai-sdk/known-tool-name";
import { isVisibleIntermediatePart, isVisibleOmPart } from "@/lib/ai-sdk/tool-parts";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types.server";
import type {
  ThreadUIMessagePart,
  WorkTiming,
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
  timing: WorkTiming | undefined;
};

export type AssistantMessageBlock = AssistantMessageTextBlock | AssistantMessageRunBlock;

/**
 * A finished observation cycle keeps both its start and its end marker on the message, and only
 * the end one is worth showing.
 */
const isSupersededOmStart = (parts: ThreadUIMessagePart[], part: ThreadUIMessagePart): boolean => {
  if (part.type !== "data-om-observation-start" && part.type !== "data-om-buffering-start") {
    return false;
  }

  return parts.some((other) => {
    if (
      other.type !== "data-om-observation-end" &&
      other.type !== "data-om-observation-failed" &&
      other.type !== "data-om-buffering-end" &&
      other.type !== "data-om-buffering-failed"
    ) {
      return false;
    }

    return other.data.cycleId === part.data.cycleId;
  });
};

export const groupAssistantParts = (
  parts: ThreadUIMessagePart[],
  workTimings: WorkTiming[] = [],
): AssistantMessageBlock[] => {
  const blocks: AssistantMessageBlock[] = [];
  let index = 0;
  let workIndex = 0;

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

      index += 1;

      if (isVisibleIntermediatePart(runPart) && !isSupersededOmStart(parts, runPart)) {
        runParts.push(runPart);
      }
    }

    if (runParts.length === 0) continue;

    // Work opens on reasoning or a tool call, never on a memory marker, so the timings line up
    // with the runs that hold one.
    const didWork = !runParts.every(isVisibleOmPart);
    blocks.push({
      type: "run",
      id: `run-${startIndex}`,
      parts: runParts,
      timing: didWork ? workTimings.at(workIndex) : undefined,
    });

    if (didWork) {
      workIndex += 1;
    }
  }

  return blocks;
};

export type WorkActivityKind = "default" | "memory" | "research";

export const TOOL_WORK_ACTIVITY_KIND = {
  "agent-reader": "default",
  "agent-worker": "default",
  webSearch: "research",
  webFetch: "research",
  fileVectorSearch: "research",
  fileGraphRag: "research",
  searchFile: "research",
  readFile: "default",
  compute: "default",
  computeDocs: "default",
  recall: "default",
} as const satisfies Record<MnemonicToolName, WorkActivityKind>;

export const getDominantWorkActivityKind = (parts: ThreadUIMessagePart[]): WorkActivityKind => {
  if (parts.every(isVisibleOmPart)) {
    return "memory";
  }

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
