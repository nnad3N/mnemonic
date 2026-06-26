import {
  DeleteObjectsCommand,
  S3Client as AwsS3Client,
} from "@aws-sdk/client-s3";
import { Result, TaggedError } from "better-result";
import { S3Client } from "bun";

import { env } from "@/env";

const S3_RETRY = {
  times: 3,
  delayMs: 200,
  backoff: "exponential" as const,
};

const S3_BATCH_DELETE_MAX_KEYS = 1000;

export class S3Error extends TaggedError("S3Error")<{ message: string }>() {}

const toS3Error = (cause: unknown): S3Error => {
  if (S3Error.is(cause)) {
    return cause;
  }

  if (cause instanceof Error) {
    return new S3Error({ message: cause.message });
  }

  return new S3Error({ message: "Unknown S3 error" });
};

const client = new S3Client({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  bucket: env.S3_BUCKET,
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  virtualHostedStyle: env.S3_FORCE_PATH_STYLE !== "true",
});

const awsClient = new AwsS3Client({
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  region: env.S3_REGION,
});

export const getPresignedPutUrl = async (input: {
  contentLength: number;
  contentType: string;
  expiresIn: number;
  key: string;
}) =>
  Result.try({
    try: () =>
      client.presign(input.key, {
        expiresIn: input.expiresIn,
        method: "PUT",
        type: input.contentType,
      }),
    catch: toS3Error,
  });

export const getPresignedGetUrl = async (input: {
  expiresIn: number;
  key: string;
  contentDisposition?: string;
}) =>
  Result.try({
    try: () =>
      client.presign(input.key, {
        contentDisposition: input.contentDisposition,
        expiresIn: input.expiresIn,
      }),
    catch: toS3Error,
  });

export const statObject = async (key: string) =>
  Result.tryPromise(
    {
      try: async () => client.stat(key),
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

export const getObject = async (key: string) =>
  Result.tryPromise(
    {
      try: async () => client.file(key).bytes(),
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

export const deleteObject = async (key: string) =>
  Result.tryPromise(
    {
      try: async () => {
        await client.delete(key);
      },
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

const deleteObjectBatch = async (keys: string[]) =>
  Result.tryPromise(
    {
      try: async () => {
        const output = await awsClient.send(
          new DeleteObjectsCommand({
            Bucket: env.S3_BUCKET,
            Delete: {
              Objects: keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          })
        );

        const error = output.Errors?.at(0);

        if (error) {
          throw new S3Error({
            message: error.Message ?? "Batch delete failed",
          });
        }
      },
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

const chunkKeys = (keys: string[], size: number) => {
  const chunks: string[][] = [];

  for (let index = 0; index < keys.length; index += size) {
    chunks.push(keys.slice(index, index + size));
  }

  return chunks;
};

export const deleteObjects = async (input: { keys: string[] }) => {
  if (input.keys.length === 0) {
    return Result.ok();
  }

  const batchResults = await Promise.all(
    chunkKeys(input.keys, S3_BATCH_DELETE_MAX_KEYS).map(async (keys) =>
      deleteObjectBatch(keys)
    )
  );
  const [, errors] = Result.partition(batchResults);

  if (errors.length > 0) {
    return Result.err(errors[0]);
  }

  return Result.ok();
};
