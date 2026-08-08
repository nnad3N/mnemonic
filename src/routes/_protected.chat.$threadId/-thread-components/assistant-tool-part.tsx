import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName, isStaticToolUIPart } from "ai";
import { T } from "gt-tanstack-start";
import type { ReactNode } from "react";

import { KnownToolName } from "@/lib/ai-sdk/known-tool-name";
import { getToolPartStatus, type ToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types";
import {
  ToolIndicator,
  type ToolIndicatorProps,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

const isRecoverableFailure = (part: ToolUIPart<ThreadUITools>): boolean => {
  if (part.state !== "output-available") {
    return false;
  }

  switch (part.type) {
    case "tool-docs":
      switch (part.output.type) {
        case "error":
          return true;
        case "list":
        case "member":
        case "search":
          return false;
      }
    case "tool-executeCode":
      switch (part.output.type) {
        case "error":
          return true;
        case "success":
          return false;
      }
    case "tool-getFile":
      switch (part.output.type) {
        case "error":
          return true;
        case "file":
        case "text":
          return false;
      }
    case "tool-webFetch":
      switch (part.output.type) {
        case "error":
          return true;
        case "success":
          return false;
      }
    case "tool-fileGraphRag":
    case "tool-fileVectorSearch":
    case "tool-recall":
    case "tool-webSearch":
      return false;
  }
};

const renderToolLabel = (toolName: MnemonicToolName, status: ToolPartStatus): ReactNode => {
  switch (toolName) {
    case "docs":
      switch (status) {
        case "pending":
          return <T>Reading library documentation</T>;
        case "done":
          return <T>Read library documentation</T>;
        case "error":
          return <T>Could not read library documentation</T>;
      }
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
    case "executeCode":
      switch (status) {
        case "pending":
          return <T>Executing code</T>;
        case "done":
          return <T>Executed code</T>;
        case "error":
          return <T>Could not execute code</T>;
      }
    case "getFile":
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
  if (!KnownToolName.is(toolName)) {
    return null;
  }

  const status: ToolPartStatus =
    isStaticToolUIPart(part) && isRecoverableFailure(part) ? "error" : getToolPartStatus(part);

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
