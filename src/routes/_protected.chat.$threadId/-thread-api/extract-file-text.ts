import { extractBytes } from "@kreuzberg/node";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

import { SUPPORTED_MIME_TYPES, UPLOAD_MAX_BYTES } from "@/lib/file-validation";

const extractFileTextSchema = v.object({
  file: v.pipe(
    v.blob(),
    v.mimeType(SUPPORTED_MIME_TYPES),
    v.maxSize(UPLOAD_MAX_BYTES)
  ),
});

type ExtractFileTextSchema = v.InferInput<typeof extractFileTextSchema>;

export const getExtractFileTextData = (
  data: ExtractFileTextSchema
): FormData => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value);
  }

  return formData;
};

export const extractFileText = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    // runtime check
    if (data instanceof FormData) {
      return v.parse(extractFileTextSchema, Object.fromEntries(data.entries()));
    }

    return v.parse(extractFileTextSchema, data);
  })
  .handler(async ({ data }) => {
    const fileBytes = Buffer.from(await data.file.arrayBuffer());
    const extraction = await extractBytes(fileBytes, data.file.type);

    return { text: extraction.content };
  });
