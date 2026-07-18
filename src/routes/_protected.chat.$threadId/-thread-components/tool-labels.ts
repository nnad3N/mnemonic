import type { MnemonicUITools } from "@/mastra/mnemonic-tool-types";

export type ToolLabels = {
  done: string;
  error: string;
  pending: string;
};

export const TOOL_LABELS = {
  fileGraphRag: {
    done: "Searched file connections",
    error: "Could not search file connections",
    pending: "Searching file connections",
  },
  fileVectorSearch: {
    done: "Searched files",
    error: "Could not search files",
    pending: "Searching files",
  },
  accessTopic: {
    done: "Accessed topic",
    error: "Could not access topic",
    pending: "Accessing topic",
  },
  getFileFromS3: {
    done: "Read file",
    error: "Could not read file",
    pending: "Reading file",
  },
  recall: {
    done: "Recalled memories",
    error: "Could not recall memories",
    pending: "Recalling memories",
  },
  webFetch: {
    done: "Fetched the web page",
    error: "Could not fetch the web page",
    pending: "Fetching the web page",
  },
  webSearch: {
    done: "Searched the web",
    error: "Could not search the web",
    pending: "Searching the web",
  },
} as const satisfies Record<keyof MnemonicUITools, ToolLabels>;

export const isKnownToolName = (toolName: string): toolName is keyof typeof TOOL_LABELS =>
  toolName in TOOL_LABELS;
