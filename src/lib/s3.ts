import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ServiceException } from "@smithy/core/client";
import { Result, TaggedError } from "better-result";

import { env } from "@/env";

const S3_RETRY = {
  times: 3,
  delayMs: 200,
  backoff: "exponential" as const,
};

const S3_BATCH_DELETE_MAX_KEYS = 1000;

export class S3Error extends TaggedError("S3Error")<{
  message: string;
  status?: number;
}>() {}

const toS3Error = (cause: unknown): S3Error => {
  if (S3Error.is(cause)) {
    return cause;
  }

  if (ServiceException.isInstance(cause)) {
    return new S3Error({
      message: cause.message,
      status: cause.$metadata.httpStatusCode,
    });
  }

  return new S3Error({
    message: "Unknown S3 error",
  });
};

const client = new S3Client({
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
  Result.tryPromise(
    {
      try: async () =>
        getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            ContentLength: input.contentLength,
            ContentType: input.contentType,
            Key: input.key,
          }),
          { expiresIn: input.expiresIn }
        ),
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

export const getPresignedGetUrl = async (input: {
  expiresIn: number;
  key: string;
  responseContentDisposition?: string;
}) =>
  Result.tryPromise(
    {
      try: async () =>
        getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: input.key,
            ResponseContentDisposition: input.responseContentDisposition,
          }),
          { expiresIn: input.expiresIn }
        ),
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

export const headObject = async (input: { key: string }) => {
  const result = await Result.tryPromise(
    {
      try: async () =>
        client.send(
          new HeadObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: input.key,
          })
        ),
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

  return result.andThen((output) => {
    const contentLength = output.ContentLength;

    if (contentLength === undefined) {
      return Result.err(
        new S3Error({
          message: "Object exists but Content-Length is missing",
        })
      );
    }

    return Result.ok({ contentLength });
  });
};

export const getObject = async (input: { key: string }) => {
  const result = await Result.tryPromise(
    {
      try: async () =>
        client.send(
          new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: input.key,
          })
        ),
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

  if (Result.isError(result)) {
    return Result.err(result.error);
  }

  const { Body } = result.value;

  if (Body === undefined) {
    return Result.err(
      new S3Error({
        message: "Object exists but body is missing",
      })
    );
  }

  const bytes = await Body.transformToByteArray();

  return Result.ok(bytes);
};

const deleteObjectBatch = async (input: { keys: string[] }) =>
  Result.tryPromise(
    {
      try: async () => {
        const output = await client.send(
          new DeleteObjectsCommand({
            Bucket: env.S3_BUCKET,
            Delete: {
              Objects: input.keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          })
        );

        const failed = output.Errors ?? [];

        if (failed.length > 0) {
          const first = failed[0];

          throw new S3Error({
            message: first?.Message ?? "Batch delete failed",
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
      deleteObjectBatch({ keys })
    )
  );
  const [, errors] = Result.partition(batchResults);

  if (errors.length > 0) {
    return Result.err(errors[0]);
  }

  return Result.ok();
};
