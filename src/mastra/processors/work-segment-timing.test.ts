import { MessageList } from "@mastra/core/agent/message-list";
import type { ProcessOutputStreamArgs, ProcessorStreamWriter } from "@mastra/core/processors";
import type { ChunkType } from "@mastra/core/stream";
import { describe, expect, it, vi } from "vitest";

import { workSegmentTimingProcessor } from "./work-segment-timing";

const createCustomMock = () => vi.fn<ProcessorStreamWriter["custom"]>();

const baseChunk = (type: string): ChunkType =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- stream chunk shape is wider than tests need.
  ({
    type,
    runId: "run-1",
    from: "AGENT",
    payload: {},
  }) as ChunkType;

const processPart = async ({
  part,
  state,
  writer,
}: {
  part: ChunkType;
  state: Record<string, unknown>;
  writer?: ProcessOutputStreamArgs["writer"];
}) => {
  const result = await workSegmentTimingProcessor.processOutputStream({
    part,
    streamParts: [],
    state,
    writer,
    abort: () => {
      throw new Error("abort");
    },
    retryCount: 0,
  });

  return result;
};

describe("workSegmentTimingProcessor", () => {
  it("emits data-work-start on the first start chunk", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({
      type: "data-work-start",
      data: {
        segmentId: expect.any(String),
        startedAt: expect.any(String),
      },
    });
    expect(state).toMatchObject({
      turnStarted: true,
      segment: {
        status: "open",
        start: {
          segmentId: expect.any(String),
          startedAt: expect.any(String),
        },
      },
    });
  });

  it("emits data-work-start on step-start when start has not opened the turn yet", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("step-start"),
      state,
      writer: { custom },
    });

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({ type: "data-work-start" });
  });

  it("does not emit data-work-start on tool-call", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });
    custom.mockClear();

    await processPart({
      part: baseChunk("tool-call"),
      state,
      writer: { custom },
    });

    expect(custom).not.toHaveBeenCalled();
  });

  it("does not double-open while a segment is already open", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });
    await processPart({
      part: baseChunk("step-start"),
      state,
      writer: { custom },
    });

    expect(custom).toHaveBeenCalledOnce();
  });

  it("keeps open segment state across chunks in the same request state object", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });

    const openSegment = state.segment;
    expect(openSegment).toMatchObject({ status: "open" });

    await processPart({
      part: baseChunk("reasoning-delta"),
      state,
      writer: { custom },
    });

    expect(state.segment).toBe(openSegment);
  });

  it("emits data-work-end on text-start only when a start is open", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("text-start"),
      state,
      writer: { custom },
    });

    expect(custom).not.toHaveBeenCalled();

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });
    custom.mockClear();

    await processPart({
      part: baseChunk("text-start"),
      state,
      writer: { custom },
    });

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({
      type: "data-work-end",
      data: {
        segmentId: expect.any(String),
        completedAt: expect.any(String),
        durationMs: expect.any(Number),
      },
    });
    expect(state.segment).toEqual({ status: "closed" });
  });

  it("opens a later segment on text-end and does not open on the following tool-call", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });
    await processPart({
      part: baseChunk("text-start"),
      state,
      writer: { custom },
    });
    custom.mockClear();

    await processPart({
      part: baseChunk("text-end"),
      state,
      writer: { custom },
    });

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({ type: "data-work-start" });
    custom.mockClear();

    await processPart({
      part: baseChunk("tool-call"),
      state,
      writer: { custom },
    });

    expect(custom).not.toHaveBeenCalled();
  });

  it("emits one matching work-end before finish completes", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });

    const segmentId =
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test owns the open segment shape.
      (state.segment as { status: "open"; start: { segmentId: string } }).start.segmentId;
    custom.mockClear();

    await processPart({
      part: baseChunk("finish"),
      state,
      writer: { custom },
    });

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({
      type: "data-work-end",
      data: { segmentId },
    });
    expect(state.segment).toEqual({ status: "closed" });
  });

  it.each(["abort", "error"])("emits one matching work-end on %s", async (type) => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });
    const segmentId =
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test owns the open segment shape.
      (state.segment as { status: "open"; start: { segmentId: string } }).start.segmentId;
    custom.mockClear();

    const part = baseChunk(type);

    await expect(processPart({ part, state, writer: { custom } })).resolves.toBe(part);

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({
      type: "data-work-end",
      data: { segmentId },
    });
    expect(state.segment).toEqual({ status: "closed" });
  });

  it("passes the original chunk through unchanged", async () => {
    const part = baseChunk("tool-call");
    const state: Record<string, unknown> = {};

    await expect(
      processPart({
        part,
        state,
        writer: { custom: createCustomMock() },
      }),
    ).resolves.toBe(part);
  });

  it("emits one matching work-end in processOutputResult using request state", async () => {
    const custom = createCustomMock();
    const state: Record<string, unknown> = {};
    const messageList = new MessageList();

    await processPart({
      part: baseChunk("start"),
      state,
      writer: { custom },
    });

    const segmentId =
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test owns the open segment shape.
      (state.segment as { status: "open"; start: { segmentId: string } }).start.segmentId;
    custom.mockClear();

    await workSegmentTimingProcessor.processOutputResult({
      messageList,
      messages: [],
      state,
      writer: { custom },
      result: {
        text: "",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: "tool-calls",
        steps: [],
      },
      abort: () => {
        throw new Error("abort");
      },
      retryCount: 0,
    });

    expect(custom).toHaveBeenCalledOnce();
    expect(custom.mock.calls.at(0)?.at(0)).toMatchObject({
      type: "data-work-end",
      data: { segmentId },
    });
    expect(state.segment).toEqual({ status: "closed" });
    expect(messageList.get.response.db()).toEqual([]);
  });
});
