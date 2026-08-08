import { Result } from "better-result";

import { createS3Kit, S3Error } from "@/lib/s3-kit";
import type { S3Api } from "@/lib/s3-kit";

type S3Call =
  | { method: "deleteObject"; key: string }
  | { method: "deleteObjects"; keys: string[] }
  | { method: "getObject"; key: string }
  | { method: "getPresignedGetUrl"; key: string }
  | { method: "getPresignedPutUrl"; key: string }
  | { method: "statObject"; key: string };

type FakeS3Options = {
  /** Keys that should fail with S3Error on the next matching call. */
  failingKeys?: Set<string>;
};

export const createFakeS3 = (options: FakeS3Options = {}) => {
  const objects = new Map<string, Uint8Array>();
  const calls: S3Call[] = [];
  const failingKeys = options.failingKeys ?? new Set<string>();

  const failIfConfigured = (key: string) => {
    if (!failingKeys.has(key)) {
      return null;
    }

    return Result.err(
      new S3Error({
        message: "S3 operation failed",
        code: "FakeS3Error",
      }),
    );
  };

  const api: S3Api = {
    deleteObject: async (key) => {
      calls.push({ method: "deleteObject", key });
      const failure = failIfConfigured(key);
      if (failure) {
        return Promise.resolve(failure);
      }

      objects.delete(key);
      return Promise.resolve(Result.ok());
    },
    deleteObjects: async (input) => {
      calls.push({ method: "deleteObjects", keys: input.keys });

      for (const key of input.keys) {
        const failure = failIfConfigured(key);
        if (failure) {
          return Promise.resolve(failure);
        }
      }

      for (const key of input.keys) {
        objects.delete(key);
      }

      return Promise.resolve(Result.ok());
    },
    getObject: async (key) => {
      calls.push({ method: "getObject", key });
      const failure = failIfConfigured(key);
      if (failure) {
        return Promise.resolve(failure);
      }

      const value = objects.get(key);
      if (value === undefined) {
        return Promise.resolve(
          Result.err(
            new S3Error({
              message: "S3 operation failed",
              code: "NoSuchKey",
            }),
          ),
        );
      }

      return Promise.resolve(Result.ok(value));
    },
    getPresignedGetUrl: async (input) => {
      calls.push({ method: "getPresignedGetUrl", key: input.key });
      return Promise.resolve(Result.ok(`https://s3.test/get/${input.key}`));
    },
    getPresignedPutUrl: async (input) => {
      calls.push({ method: "getPresignedPutUrl", key: input.key });
      return Promise.resolve(Result.ok(`https://s3.test/put/${input.key}`));
    },
    statObject: async (key) => {
      calls.push({ method: "statObject", key });
      const failure = failIfConfigured(key);
      if (failure) {
        return Promise.resolve(failure);
      }

      const value = objects.get(key);
      if (value === undefined) {
        return Promise.resolve(
          Result.err(
            new S3Error({
              message: "S3 operation failed",
              code: "NoSuchKey",
            }),
          ),
        );
      }

      return Promise.resolve(Result.ok({ size: value.byteLength }));
    },
  };

  return {
    calls,
    failingKeys,
    kit: createS3Kit(api),
    objects,
    put: (key: string, body: Uint8Array) => {
      objects.set(key, body);
    },
    reset: () => {
      calls.length = 0;
      failingKeys.clear();
      objects.clear();
    },
  };
};

export type FakeS3 = ReturnType<typeof createFakeS3>;
