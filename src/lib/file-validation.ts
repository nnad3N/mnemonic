// Generated from @kreuzberg/node@4.9.9 via validateMimeType.

import { Result } from "better-result";

import { ArtifactUploadError } from "@/lib/errors/artifact-upload-error";

export type MimeType = `${string}/${string}`;

export const SUPPORTED_MIME_TYPES: MimeType[] = [
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
  "image/*",
  "image/aces",
  "image/apng",
  "image/bmp",
  "image/cgm",
  "image/dicom-rle",
  "image/emf",
  "image/fits",
  "image/g3fax",
  "image/gif",
  "image/ief",
  "image/jls",
  "image/jp2",
  "image/jpeg",
  "image/jpm",
  "image/jpx",
  "image/ktx",
  "image/naplps",
  "image/pjpeg",
  "image/png",
  "image/prs.btif",
  "image/prs.pti",
  "image/pwg-raster",
  "image/sgi",
  "image/svg+xml",
  "image/t38",
  "image/tiff",
  "image/tiff-fx",
  "image/vnd.adobe.photoshop",
  "image/vnd.airzip.accelerator.azv",
  "image/vnd.cns.inf2",
  "image/vnd.dece.graphic",
  "image/vnd.djvu",
  "image/vnd.dvb.subtitle",
  "image/vnd.dwg",
  "image/vnd.dxf",
  "image/vnd.fastbidsheet",
  "image/vnd.fpx",
  "image/vnd.fst",
  "image/vnd.fujixerox.edmics-mmr",
  "image/vnd.fujixerox.edmics-rlc",
  "image/vnd.globalgraphics.pgb",
  "image/vnd.microsoft.icon",
  "image/vnd.mix",
  "image/vnd.mozilla.apng",
  "image/vnd.ms-modi",
  "image/vnd.ms-photo",
  "image/vnd.net-fpx",
  "image/vnd.radiance",
  "image/vnd.sealed.png",
  "image/vnd.sealedmedia.softseal.gif",
  "image/vnd.sealedmedia.softseal.jpg",
  "image/vnd.svf",
  "image/vnd.tencent.tap",
  "image/vnd.valve.source.texture",
  "image/vnd.wap.wbmp",
  "image/vnd.xiff",
  "image/vnd.zbrush.pcx",
  "image/webp",
  "image/wmf",
  "image/x-3ds",
  "image/x-cmu-raster",
  "image/x-cmx",
  "image/x-freehand",
  "image/x-icon",
  "image/x-jng",
  "image/x-mrsid-image",
  "image/x-ms-bmp",
  "image/x-pcx",
  "image/x-pict",
  "image/x-portable-anymap",
  "image/x-portable-bitmap",
  "image/x-portable-graymap",
  "image/x-portable-pixmap",
  "image/x-rgb",
  "image/x-tga",
  "image/x-xbitmap",
  "image/x-xcf",
  "image/x-xpixmap",
  "image/x-xwindowdump",
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
];

export const LLM_NATIVE_IMAGE_MIME_TYPES: MimeType[] = [
  "application/pdf",
  "application/json",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/xml",
  "text/x-markdown",
  "text/yaml",
  "image/apng",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jp2",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon",
  "image/x-ms-bmp",
];

export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

export const isSupportedMimeType = (mimeType: string): boolean =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  SUPPORTED_MIME_TYPES.includes(mimeType as MimeType);

export const isLLMNativeImageMimeType = (mimeType: string): boolean =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  LLM_NATIVE_IMAGE_MIME_TYPES.includes(mimeType as MimeType);

export const isImageMimeType = (mimeType: string): boolean =>
  mimeType.startsWith("image/");

export const validateUploadFile = (input: {
  mimeType: string;
  sizeBytes: number;
}) => {
  if (!isSupportedMimeType(input.mimeType)) {
    return Result.err(
      new ArtifactUploadError({
        reason: "unsupported-mime-type",
      })
    );
  }

  if (input.sizeBytes > UPLOAD_MAX_BYTES) {
    return Result.err(
      new ArtifactUploadError({
        reason: "file-too-large",
      })
    );
  }

  return Result.ok();
};
