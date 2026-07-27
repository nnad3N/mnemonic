import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName } from "ai";
import { T } from "gt-tanstack-start";
import type { ReactNode } from "react";

import { getToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import {
  ToolIndicator,
  type ToolIndicatorProps,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
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
    case "fileVectorSearch":
      switch (status) {
        case "pending":
          return <T>Searching files</T>;
        case "done":
          return <T>Searched files</T>;
        case "error":
          return <T>Could not search files</T>;
      }
    case "accessTopic":
      switch (status) {
        case "pending":
          return <T>Accessing topic</T>;
        case "done":
          return <T>Accessed topic</T>;
        case "error":
          return <T>Could not access topic</T>;
      }
    case "executeCode":
      switch (status) {
        case "pending":
          return <T>Executing code</T>;
        case "done":
          return <T>Executed code</T>;
        case "error":
          return <T>Could not execute code</T>;
      }
    case "getFileFromS3":
      switch (status) {
        case "pending":
          return <T>Reading file</T>;
        case "done":
          return <T>Read file</T>;
        case "error":
          return <T>Could not read file</T>;
      }
    case "recall":
      switch (status) {
        case "pending":
          return <T>Recalling memories</T>;
        case "done":
          return <T>Recalled memories</T>;
        case "error":
          return <T>Could not recall memories</T>;
      }
    case "webFetch":
      switch (status) {
        case "pending":
          return <T>Fetching the web page</T>;
        case "done":
          return <T>Fetched the web page</T>;
        case "error":
          return <T>Could not fetch the web page</T>;
      }
    case "webSearch":
      switch (status) {
        case "pending":
          return <T>Searching the web</T>;
        case "done":
          return <T>Searched the web</T>;
        case "error":
          return <T>Could not search the web</T>;
      }
  }
};

type AssistantToolPartProps = Omit<ToolIndicatorProps, "enabled" | "pending" | "part"> & {
  part: DynamicToolUIPart | ToolUIPart<ThreadUITools>;
};

export const AssistantToolPart = ({
  part,
  className,
  children,
  ...props
}: AssistantToolPartProps) => {
  const toolName = getToolName(part);
  if (!isKnownToolName(toolName)) {
    return null;
  }

  const status = getToolPartStatus(part);

  return (
    <ToolIndicator
      {...props}
      className={cn(status === "error" && "text-destructive", className)}
      pending={status === "pending"}
    >
      {renderToolLabel(toolName, status)}
      {children}
    </ToolIndicator>
  );
};
