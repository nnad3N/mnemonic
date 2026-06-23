import {
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
