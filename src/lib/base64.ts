import * as v from "valibot";

const DATA_URL_PREFIX = "data:";
const base64Schema = v.pipe(v.string(), v.base64());

export const decodeBase64DataUrl = (data: string): Uint8Array<ArrayBuffer> | null => {
  if (!data.startsWith(DATA_URL_PREFIX)) {
    return null;
  }

  const commaIndex = data.indexOf(",");

  if (commaIndex === -1) {
    return null;
  }

  const meta = data.slice(DATA_URL_PREFIX.length, commaIndex).toLowerCase();

  if (!meta.split(";").includes("base64")) {
    return null;
  }

  const payload = data.slice(commaIndex + 1);

  const parsed = v.safeParse(base64Schema, payload);

  if (!parsed.success) {
    return null;
  }

  return Uint8Array.fromBase64(parsed.output);
};
