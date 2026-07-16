import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client as AwsS3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Result, TaggedError } from "better-result";

import { env } from "@/env";
import { Kit } from "@/lib/kit";

const S3_RETRY = {
  times: 3,
  delayMs: 200,
  backoff: "exponential" as const,
};

const S3_BATCH_DELETE_MAX_KEYS = 1000;

export class S3Error extends TaggedError("S3Error")<{
  cause?: unknown;
  code?: string;
  message: string;
  requestId?: string;
  statusCode?: number;
}>() {}

const toS3Error = (error: unknown): S3Error => {
  if (S3Error.is(error)) {
    return error;
  }

  if (error instanceof S3ServiceException) {
    return new S3Error({
      cause: error,
      code: error.name,
      message: error.message,
      requestId: error.$metadata.requestId,
      statusCode: error.$metadata.httpStatusCode,
    });
  }

  if (error instanceof Error) {
    return new S3Error({ cause: error, message: error.message });
  }

  return new S3Error({ cause: error, message: "Unknown S3 error" });
};

const client = new AwsS3Client({
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  region: env.S3_REGION,
});

type PresignedPutUrlInput = {
  contentLength: number;
  contentType: string;
  expiresIn: number;
  key: string;
};

const getPresignedPutUrlOperation = async (input: PresignedPutUrlInput) =>
  Result.tryPromise({
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
  });

type PresignedGetUrlInput = {
  contentDisposition?: string;
  expiresIn: number;
  key: string;
};

const getPresignedGetUrlOperation = async (input: PresignedGetUrlInput) =>
  Result.tryPromise({
    try: async () =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: input.key,
          ResponseContentDisposition: input.contentDisposition,
        }),
        { expiresIn: input.expiresIn }
      ),
    catch: toS3Error,
  });

const statObjectOperation = async (key: string) =>
  Result.tryPromise(
    {
      try: async () => {
        const output = await client.send(
          new HeadObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
          })
        );

        if (output.ContentLength === undefined) {
          throw new S3Error({
            cause: output,
            message: "S3 object response did not include a content length",
            requestId: output.$metadata.requestId,
            statusCode: output.$metadata.httpStatusCode,
          });
        }

        return { size: output.ContentLength };
      },
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

const getObjectOperation = async (key: string) =>
  Result.tryPromise(
    {
      try: async () => {
        const output = await client.send(
          new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
          })
        );

        if (!output.Body) {
          throw new S3Error({
            cause: output,
            message: "S3 object response did not include a body",
            requestId: output.$metadata.requestId,
            statusCode: output.$metadata.httpStatusCode,
          });
        }

        return output.Body.transformToByteArray();
      },
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

const deleteObjectOperation = async (key: string) =>
  Result.tryPromise(
    {
      try: async () => {
        await client.send(
          new DeleteObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
          })
        );
      },
      catch: toS3Error,
    },
    { retry: S3_RETRY }
  );

const deleteObjectBatch = async (keys: string[]) =>
  Result.tryPromise(
    {
      try: async () => {
        const output = await client.send(
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
            cause: error,
            code: error.Code,
            message: error.Message ?? "Batch delete failed",
            requestId: output.$metadata.requestId,
            statusCode: output.$metadata.httpStatusCode,
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

type DeleteObjectsInput = {
  keys: string[];
};

const deleteObjectsOperation = async (input: DeleteObjectsInput) => {
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

export const s3Kit = Kit.define("s3", {
  deleteObject: deleteObjectOperation,
  deleteObjects: deleteObjectsOperation,
  getObject: getObjectOperation,
  getPresignedGetUrl: getPresignedGetUrlOperation,
  getPresignedPutUrl: getPresignedPutUrlOperation,
  statObject: statObjectOperation,
});

export type S3Kit = typeof s3Kit;
