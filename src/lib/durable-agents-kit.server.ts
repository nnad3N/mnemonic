import type { Event } from "@mastra/core/events";
import type { RedisClient } from "@mastra/redis";
import { RedisServerCache, nodeRedisPreset } from "@mastra/redis";
import { RedisStreamsPubSub } from "@mastra/redis-streams";
import { Result, TaggedError } from "better-result";
import type { Result as ResultType } from "better-result";
import { createClient } from "redis";

import type { ThreadRunStatus } from "@/db/schema.server";
import { env } from "@/env";
import * as Kit from "@/lib/kit";
import type { SafeId } from "@/lib/safe-id";

/** Mastra's default is 5 minutes, shorter than a research run. */
const CACHE_TTL_SECONDS = 60 * 60;

// node-redis emits `error` on the client itself; without a listener a dropped connection is an
// unhandled event that takes the process down.
const cacheClient = createClient({ url: env.REDIS_URL }).on("error", (error: unknown) => {
  console.error("[durable-agents] redis cache client error", error);
});

export const durableAgentsCache = new RedisServerCache(
  {
    // `RedisClient` is typed against ioredis' lowercase `llen`/`rpush`/`lrange`, which node-redis
    // spells `lLen`/`rPush`/`lRange`. Those three are the only members it is missing, and
    // `nodeRedisPreset` replaces every call site for them, so they are never reached.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    client: cacheClient as unknown as RedisClient,
  },
  { ...nodeRedisPreset, ttlSeconds: CACHE_TTL_SECONDS },
);

export const durableAgentsPubsub = new RedisStreamsPubSub({
  url: env.REDIS_URL,
  // Every subscribe replays its topic's stream from the beginning, and Redis keeps a stream
  // until something deletes it. Nothing older than the cache is replayable anyway.
  streamIdleTtlMs: CACHE_TTL_SECONDS * 1000,
});

export class DurableAgentsError extends TaggedError("DurableAgentsError")<{
  cause: unknown;
  message: string;
}> {}

/** Mastra has no cancel channel. */
const getCancelTopic = (runId: SafeId<"run">) => `mnemonic:agent-cancel:${runId}`;

const getUserThreadsTopic = (userId: SafeId<"user">) => `mnemonic:user-threads:${userId}`;

export type ThreadRunEvent = {
  finishedAt: Date | null;
  status: ThreadRunStatus;
  threadId: string;
};

/** Returned rather than paired with an `unsubscribe` method so callers cannot lose the handler. */
type Unsubscribe = () => Promise<ResultType<void, DurableAgentsError>>;

type PublishRunEventInput = ThreadRunEvent & {
  runId: SafeId<"run">;
  userId: SafeId<"user">;
};

export type DurableAgentsApi = {
  connect: () => Promise<ResultType<void, DurableAgentsError>>;
  publishCancel: (input: { runId: SafeId<"run"> }) => Promise<ResultType<void, DurableAgentsError>>;
  publishRunEvent: (input: PublishRunEventInput) => Promise<ResultType<void, DurableAgentsError>>;
  subscribeCancel: (input: {
    onCancel: () => void;
    runId: SafeId<"run">;
  }) => Promise<ResultType<Unsubscribe, DurableAgentsError>>;
  subscribeRunEvents: (input: {
    onEvent: (event: ThreadRunEvent) => void;
    userId: SafeId<"user">;
  }) => Promise<ResultType<Unsubscribe, DurableAgentsError>>;
};

export const createDurableAgentsKit = (api: DurableAgentsApi) => Kit.define("durableAgents", api);

const subscribe = async (topic: string, handler: (event: Event) => void) =>
  Result.tryPromise({
    try: async () => {
      await durableAgentsPubsub.subscribe(topic, handler);

      const unsubscribe: Unsubscribe = async () =>
        Result.tryPromise({
          try: async () => durableAgentsPubsub.unsubscribe(topic, handler),
          catch: (cause) =>
            new DurableAgentsError({ cause, message: `Failed to unsubscribe from ${topic}` }),
        });

      return unsubscribe;
    },
    catch: (cause) => new DurableAgentsError({ cause, message: `Failed to subscribe to ${topic}` }),
  });

export const durableAgentsKit = createDurableAgentsKit({
  /** `RedisServerCache` never connects the client it is given, and node-redis does not auto-connect. */
  connect: async () =>
    Result.tryPromise({
      try: async () => {
        if (!cacheClient.isOpen) {
          await cacheClient.connect();
        }
      },
      catch: (cause) =>
        new DurableAgentsError({ cause, message: "Failed to connect the run cache" }),
    }),
  publishCancel: async ({ runId }) =>
    Result.tryPromise({
      try: async () =>
        durableAgentsPubsub.publish(getCancelTopic(runId), {
          type: "cancel",
          data: { runId },
          runId,
        }),
      catch: (cause) =>
        new DurableAgentsError({ cause, message: "Failed to publish the cancel event" }),
    }),
  publishRunEvent: async ({ finishedAt, runId, status, threadId, userId }) =>
    Result.tryPromise({
      try: async () =>
        durableAgentsPubsub.publish(getUserThreadsTopic(userId), {
          type: "thread-run",
          data: { finishedAt, status, threadId } satisfies ThreadRunEvent,
          runId,
        }),
      catch: (cause) =>
        new DurableAgentsError({ cause, message: "Failed to publish the thread run event" }),
    }),
  subscribeCancel: async ({ onCancel, runId }) => {
    const topic = getCancelTopic(runId);
    const subscribed = await subscribe(topic, onCancel);

    return subscribed.map((unsubscribe) => async () => {
      const result = await unsubscribe();
      // Nothing publishes to a run's cancel topic after its run settles, so the stream Redis
      // keeps behind it would otherwise outlive the run.
      await durableAgentsPubsub.clearTopic(topic);
      return result;
    });
  },
  subscribeRunEvents: async ({ onEvent, userId }) =>
    subscribe(getUserThreadsTopic(userId), (event) => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `publishRunEvent` owns this topic.
      onEvent(event.data as ThreadRunEvent);
    }),
});

export type DurableAgentsKit = typeof durableAgentsKit;
