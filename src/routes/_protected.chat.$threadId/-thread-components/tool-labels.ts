import type { MnemonicUITools } from "@/mastra/mnemonic-tool-types";
import { m } from "@/paraglide/messages";

export type ToolLabels = {
  done: () => string;
  error: () => string;
  pending: () => string;
};

export const TOOL_LABELS = {
  "artifact-graph-rag": {
    done: m.chat_thread_tool_search_connections_done,
    error: m.chat_thread_tool_search_connections_error,
    pending: m.chat_thread_tool_search_connections_pending,
  },
  "artifact-vector-search": {
    done: m.chat_thread_tool_search_files_done,
    error: m.chat_thread_tool_search_files_error,
    pending: m.chat_thread_tool_search_files_pending,
  },
  "access-topic": {
    done: m.chat_thread_tool_access_topic_done,
    error: m.chat_thread_tool_access_topic_error,
    pending: m.chat_thread_tool_access_topic_pending,
  },
  "get-artifact-from-s3": {
    done: m.chat_thread_tool_read_file_done,
    error: m.chat_thread_tool_read_file_error,
    pending: m.chat_thread_tool_read_file_pending,
  },
  recall: {
    done: m.chat_thread_tool_recall_done,
    error: m.chat_thread_tool_recall_error,
    pending: m.chat_thread_tool_recall_pending,
  },
  "web-search": {
    done: m.chat_thread_tool_web_search_done,
    error: m.chat_thread_tool_web_search_error,
    pending: m.chat_thread_tool_web_search_pending,
  },
} satisfies Record<keyof MnemonicUITools, ToolLabels>;

export const isKnownToolName = (
  toolName: string
): toolName is keyof typeof TOOL_LABELS => toolName in TOOL_LABELS;

export const getToolLabels = (toolName: string): ToolLabels | null =>
  isKnownToolName(toolName) ? TOOL_LABELS[toolName] : null;
