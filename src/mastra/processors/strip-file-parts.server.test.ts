import type { ProcessLLMRequestArgs } from "@mastra/core/processors";
import { assert, describe, expect, it } from "vitest";

import { stripFilePartsProcessor } from "./strip-file-parts.server";

type LanguageModelV2Prompt = ProcessLLMRequestArgs["prompt"];

const processPrompt = (prompt: LanguageModelV2Prompt): LanguageModelV2Prompt => {
  const result = stripFilePartsProcessor.processLLMRequest({
    prompt,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- unused by the processor under test
    model: {} as ProcessLLMRequestArgs["model"],
    stepNumber: 0,
    steps: [],
    state: {},
    abort: () => {
      throw new Error("abort");
    },
    retryCount: 0,
  });

  assert(result?.prompt, "expected processLLMRequest to return a prompt");

  return result.prompt;
};

describe("stripFilePartsProcessor", () => {
  it("drops every user file part and leaves other messages untouched", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "see this" },
          {
            type: "file",
            data: "abc",
            filename: "doc.pdf",
            mediaType: "application/pdf",
          },
          {
            type: "file",
            data: "def",
            filename: "photo.png",
            mediaType: "image/png",
          },
        ],
      },
      {
        role: "assistant",
        content: [
          {
            type: "file",
            data: "ghi",
            filename: "out.csv",
            mediaType: "text/csv",
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "compute",
            output: { type: "text", value: "ok" },
          },
        ],
      },
      {
        role: "user",
        content: [
          { type: "text", text: "and this" },
          {
            type: "file",
            data: "jkl",
            filename: "data.csv",
            mediaType: "text/csv",
          },
        ],
      },
    ];

    const result = processPrompt(prompt);

    expect(result).toEqual([
      { role: "user", content: [{ type: "text", text: "see this" }] },
      prompt.at(1),
      prompt.at(2),
      { role: "user", content: [{ type: "text", text: "and this" }] },
    ]);
    expect(result.at(1)).toBe(prompt.at(1));
    expect(result.at(2)).toBe(prompt.at(2));
  });
});
