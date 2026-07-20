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
    case "executeCode":
      switch (status) {
        case "pending":
          return <T>Executing code</T>;
        case "done":
          return <T>Executed code</T>;
        case "error":
          return <T>Could not execute code</T>;
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

type AssistantToolPartProps = Omit<ToolIndicatorProps, "part" | "pending"> & {
  part: DynamicToolUIPart | ToolUIPart<ThreadUITools>;
  interactive?: boolean;
};

export const AssistantToolPart = ({
  part,
  className,
  interactive = true,
  render,
  children,
  ...props
}: AssistantToolPartProps) => {
  const toolName = getToolName(part);
  const isKnown = isKnownToolName(toolName);
  const status = getToolPartStatus(part);

  return (
    <ToolIndicator
      enabled={isKnown}
      interactive={interactive}
      pending={status === "pending"}
      className={cn(status === "error" && "text-destructive", className)}
      render={render}
      {...props}
    >
      {isKnown ? renderToolLabel(toolName, status) : null}
      {children}
    </ToolIndicator>
  );
};
