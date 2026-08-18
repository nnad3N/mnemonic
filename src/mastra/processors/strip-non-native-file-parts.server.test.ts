import type { ProcessLLMRequestArgs } from "@mastra/core/processors";
import { assert, describe, expect, it } from "vitest";

import { stripNonNativeFilePartsProcessor } from "./strip-non-native-file-parts.server";

type LanguageModelV2Prompt = ProcessLLMRequestArgs["prompt"];

const processPrompt = (prompt: LanguageModelV2Prompt): LanguageModelV2Prompt => {
  const result = stripNonNativeFilePartsProcessor.processLLMRequest({
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

describe("stripNonNativeFilePartsProcessor", () => {
  it("keeps LLM-native user file parts", () => {
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
    ];

    const result = processPrompt(prompt);

    expect(result).toEqual(prompt);
    expect(result.at(0)).toBe(prompt.at(0));
  });

  it("drops non-LLM-native user file parts", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "user",
        content: [
          { type: "text", text: "summarize" },
          {
            type: "file",
            data: "abc",
            filename: "data.csv",
            mediaType: "text/csv",
          },
          {
            type: "file",
            data: "def",
            filename: "notes.md",
            mediaType: "text/markdown",
          },
        ],
      },
    ];

    expect(processPrompt(prompt)).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "summarize" }],
      },
    ]);
  });

  it("strips non-native files across multiple user messages", () => {
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
        ],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "got it" }],
      },
      {
        role: "user",
        content: [
          { type: "text", text: "and this" },
          {
            type: "file",
            data: "def",
            filename: "data.csv",
            mediaType: "text/csv",
          },
        ],
      },
    ];

    const result = processPrompt(prompt);

    expect(result).toEqual([
      prompt.at(0),
      prompt.at(1),
      {
        role: "user",
        content: [{ type: "text", text: "and this" }],
      },
    ]);
    expect(result.at(0)).toBe(prompt.at(0));
    expect(result.at(1)).toBe(prompt.at(1));
  });

  it("leaves assistant and tool messages unchanged", () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: "assistant",
        content: [
          {
            type: "file",
            data: "abc",
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
            toolName: "calculate",
            output: { type: "text", value: "ok" },
          },
        ],
      },
    ];

    const result = processPrompt(prompt);

    expect(result).toEqual(prompt);
    expect(result.at(0)).toBe(prompt.at(0));
    expect(result.at(1)).toBe(prompt.at(1));
  });
});
