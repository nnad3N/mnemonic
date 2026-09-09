export const hashBytes = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const hashFileContents = async (file: Blob): Promise<string> =>
  hashBytes(new Uint8Array(await file.arrayBuffer()));

export const hashText = async (text: string): Promise<string> =>
  hashBytes(new TextEncoder().encode(text));
