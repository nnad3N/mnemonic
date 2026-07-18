import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName } from "ai";
import { T } from "gt-tanstack-start";
import type { ReactNode } from "react";

import { getToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import { ThreadMetaLine } from "@/routes/_protected.chat.$threadId/-thread-components/thread-meta-line";
import { isKnownToolName } from "@/routes/_protected.chat.$threadId/-thread-components/tool-labels";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

type ToolStatus = ReturnType<typeof getToolPartStatus>;

const renderToolLabel = (toolName: keyof ThreadUITools, status: ToolStatus): ReactNode => {
  switch (toolName) {
    case "fileGraphRag":
      switch (status) {
        case "pending":
          return <T>Searching file connections</T>;
        case "done":
          return <T>Searched file connections</T>;
        case "error":
          return <T>Could not search file connections</T>;
      }
      break;
    case "fileVectorSearch":
      switch (status) {
        case "pending":
          return <T>Searching files</T>;
        case "done":
          return <T>Searched files</T>;
        case "error":
          return <T>Could not search files</T>;
      }
      break;
    case "accessTopic":
      switch (status) {
        case "pending":
          return <T>Accessing topic</T>;
        case "done":
          return <T>Accessed topic</T>;
        case "error":
          return <T>Could not access topic</T>;
      }
      break;
    case "getFileFromS3":
      switch (status) {
        case "pending":
          return <T>Reading file</T>;
        case "done":
          return <T>Read file</T>;
        case "error":
          return <T>Could not read file</T>;
      }
      break;
    case "recall":
      switch (status) {
        case "pending":
          return <T>Recalling memories</T>;
        case "done":
          return <T>Recalled memories</T>;
        case "error":
          return <T>Could not recall memories</T>;
      }
      break;
    case "webFetch":
      switch (status) {
        case "pending":
          return <T>Fetching the web page</T>;
        case "done":
          return <T>Fetched the web page</T>;
        case "error":
          return <T>Could not fetch the web page</T>;
      }
      break;
    case "webSearch":
      switch (status) {
        case "pending":
          return <T>Searching the web</T>;
        case "done":
          return <T>Searched the web</T>;
        case "error":
          return <T>Could not search the web</T>;
      }
      break;
  }
};

type AssistantToolPartProps = {
  part: DynamicToolUIPart | ToolUIPart<ThreadUITools>;
  className?: string;
};

export const AssistantToolPart = ({ part, className }: AssistantToolPartProps) => {
  const toolName = getToolName(part);

  if (!isKnownToolName(toolName)) {
    return null;
  }

  const status = getToolPartStatus(part);

  return (
    <ThreadMetaLine
      className={cn(
        status === "pending" && "shimmer",
        status === "error" && "text-destructive",
        className,
      )}
    >
      {renderToolLabel(toolName, status)}
    </ThreadMetaLine>
  );
};
