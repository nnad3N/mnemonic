import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName, isStaticToolUIPart } from "ai";
import { T } from "gt-tanstack-start";
import type { ReactNode } from "react";

import { KnownToolName } from "@/lib/ai-sdk/known-tool-name";
import { getToolPartStatus, type ToolPartStatus } from "@/lib/ai-sdk/tool-parts";
import { cn } from "@/lib/utils";
import type { MnemonicToolName } from "@/mastra/mnemonic-tool-types.server";
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
    case "tool-computeDocs":
      switch (part.output.type) {
        case "error":
          return true;
        case "list":
        case "member":
        case "search":
          return false;
      }
    case "tool-compute":
      switch (part.output.type) {
        case "error":
          return true;
        case "success":
          return false;
      }
    case "tool-readFile":
      switch (part.output.type) {
        case "error":
          return true;
        case "whole":
        case "parsed":
          return false;
      }
    case "tool-readNote":
      switch (part.output.type) {
        case "error":
          return true;
        case "note":
          return false;
      }
    case "tool-updateNote":
      switch (part.output.type) {
        case "error":
          return true;
        case "updated":
          return false;
      }
    case "tool-searchFile":
      switch (part.output.type) {
        case "error":
          return true;
        case "matches":
          return false;
      }
    case "tool-webFetch":
      switch (part.output.type) {
        case "error":
          return true;
        case "success":
          return false;
      }
    case "tool-agent-reader":
    case "tool-agent-worker":
    case "tool-fileGraphRag":
    case "tool-fileVectorSearch":
    case "tool-recall":
    case "tool-searchNotes":
    case "tool-webSearch":
    case "tool-createNote":
      return false;
  }
};

const renderToolLabel = (toolName: MnemonicToolName, status: ToolPartStatus): ReactNode => {
  switch (toolName) {
    case "agent-reader":
      switch (status) {
        case "pending":
          return <T>Reading the source</T>;
        case "done":
          return <T>Read the source</T>;
        case "error":
          return <T>Could not read the source</T>;
      }
    case "agent-worker":
      switch (status) {
        case "pending":
          return <T>Researching</T>;
        case "done":
          return <T>Researched</T>;
        case "error":
          return <T>Could not research</T>;
      }
    case "compute":
      switch (status) {
        case "pending":
          return <T>Computing</T>;
        case "done":
          return <T>Computed</T>;
        case "error":
          return <T>Could not compute</T>;
      }
    case "computeDocs":
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
    case "readFile":
      switch (status) {
        case "pending":
          return <T>Reading the file</T>;
        case "done":
          return <T>Read the file</T>;
        case "error":
          return <T>Could not read the file</T>;
      }
    case "readNote":
      switch (status) {
        case "pending":
          return <T>Reading the note</T>;
        case "done":
          return <T>Read the note</T>;
        case "error":
          return <T>Could not read the note</T>;
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
    case "searchFile":
      switch (status) {
        case "pending":
          return <T>Searching the file</T>;
        case "done":
          return <T>Searched the file</T>;
        case "error":
          return <T>Could not search the file</T>;
      }
    case "searchNotes":
      switch (status) {
        case "pending":
          return <T>Searching notes</T>;
        case "done":
          return <T>Searched notes</T>;
        case "error":
          return <T>Could not search notes</T>;
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
    case "createNote":
      switch (status) {
        case "pending":
          return <T>Creating a note</T>;
        case "done":
          return <T>Created a note</T>;
        case "error":
          return <T>Could not create the note</T>;
      }
    case "updateNote":
      switch (status) {
        case "pending":
          return <T>Updating the note</T>;
        case "done":
          return <T>Updated the note</T>;
        case "error":
          return <T>Could not update the note</T>;
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
