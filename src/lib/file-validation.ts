import { Result } from "better-result";

import { FileUploadError } from "@/lib/errors/file-upload-error";
import * as Kit from "@/lib/kit";

export type MimeType = `${string}/${string}`;

export const ImageMimeType = Kit.literals.from<MimeType>()([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type ImageMimeType = Kit.LiteralMember<typeof ImageMimeType>;

export const SupportedMimeType = Kit.literals.from<MimeType>()([
  "application/docbook+xml",
  "application/epub+zip",
  "application/gzip",
  "application/json",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/tar",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.addin.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.template.macroenabled.12",
  "application/vnd.ms-outlook",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/vnd.ms-powerpoint.template.macroenabled.12",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.ms-word.template.macroenabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.openxmlformats-officedocument.presentationml.template",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/x-7z-compressed",
  "application/x-gtar",
  "application/x-gzip",
  "application/x-latex",
  "application/x-research-info-systems",
  "application/x-tar",
  "application/x-ustar",
  "application/xhtml+xml",
  "application/xml",
  "application/zip",
  ...ImageMimeType.values,
  "message/rfc822",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/prs.fallenstein.rst",
  "text/rtf",
  "text/tab-separated-values",
  "text/troff",
  "text/x-markdown",
  "text/x-opml",
  "text/x-org",
  "text/xml",
  "text/yaml",
]);

export type SupportedMimeType = Kit.LiteralMember<typeof SupportedMimeType>;

export const LlmNativeMimeType = Kit.literals.from<MimeType>()([
  "application/pdf",
  ...ImageMimeType.values,
]);

export type LlmNativeMimeType = Kit.LiteralMember<typeof LlmNativeMimeType>;

export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export const validateUploadFile = (input: { mimeType: string; sizeBytes: number }) => {
  if (!SupportedMimeType.is(input.mimeType)) {
    return Result.err(
      new FileUploadError({
        reason: "unsupported-mime-type",
      }),
    );
  }

  if (input.sizeBytes > UPLOAD_MAX_BYTES) {
    return Result.err(
      new FileUploadError({
        reason: "file-too-large",
      }),
    );
  }

  return Result.ok();
};
