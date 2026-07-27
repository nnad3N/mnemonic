import { T } from "gt-tanstack-start";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  CollapsibleToolIndicator,
  CollapsibleToolIndicatorContent,
  CollapsibleToolIndicatorTrigger,
  ToolIndicator,
} from "@/routes/_protected.chat.$threadId/-thread-components/tool-indicator";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

type OmUiPart = Extract<
  ThreadUIMessagePart,
  {
    type:
      | "data-om-observation-start"
      | "data-om-observation-end"
      | "data-om-observation-failed"
      | "data-om-buffering-start"
      | "data-om-buffering-end"
      | "data-om-buffering-failed"
      | "data-om-activation";
  }
>;

type OmPartProps = {
  part: OmUiPart;
  messageParts: ThreadUIMessagePart[];
};

type OmOperationType = "observation" | "reflection";
type OmIndicatorStatus = "pending" | "success" | "error";

const hasCompletedOmCycle = (messageParts: ThreadUIMessagePart[], cycleId: string): boolean =>
  messageParts.some((part) => {
    if (
      part.type !== "data-om-observation-end" &&
      part.type !== "data-om-observation-failed" &&
      part.type !== "data-om-buffering-end" &&
      part.type !== "data-om-buffering-failed"
    ) {
      return false;
    }

    return part.data.cycleId === cycleId;
  });

const renderOmLabel = ({
  kind,
  operationType,
  status,
}: {
  kind: "observation" | "buffering" | "activation";
  operationType?: OmOperationType;
  status: OmIndicatorStatus;
}): ReactNode => {
  if (kind === "activation") {
    return <T>Updated memory</T>;
  }

  if (kind === "buffering") {
    if (operationType === "reflection") {
      switch (status) {
        case "pending":
          return <T>Preparing reflections</T>;
        case "success":
          return <T>Prepared reflections</T>;
        case "error":
          return <T>Could not prepare reflections</T>;
      }
    }

    switch (status) {
      case "pending":
        return <T>Preparing observations</T>;
      case "success":
        return <T>Prepared observations</T>;
      case "error":
        return <T>Could not prepare observations</T>;
    }
  }

  if (operationType === "reflection") {
    switch (status) {
      case "pending":
        return <T>Reflecting on memories</T>;
      case "success":
        return <T>Reflected on memories</T>;
      case "error":
        return <T>Could not reflect on memories</T>;
    }
  }

  switch (status) {
    case "pending":
      return <T>Observing conversation</T>;
    case "success":
      return <T>Observed conversation</T>;
    case "error":
      return <T>Could not observe conversation</T>;
  }
};

type OmIndicatorProps = {
  label: ReactNode;
  status: OmIndicatorStatus;
  observations?: string;
};

const OmIndicator = ({ label, status, observations }: OmIndicatorProps) => {
  if (observations && status === "success") {
    return (
      <CollapsibleToolIndicator>
        <CollapsibleToolIndicatorTrigger render={<ToolIndicator interactive="collapsible" />}>
          {label}
        </CollapsibleToolIndicatorTrigger>
        <CollapsibleToolIndicatorContent>{observations}</CollapsibleToolIndicatorContent>
      </CollapsibleToolIndicator>
    );
  }

  return (
    <ToolIndicator
      className={cn(status === "error" && "text-destructive")}
      pending={status === "pending"}
    >
      {label}
    </ToolIndicator>
  );
};

export const OmPart = ({ part, messageParts }: OmPartProps) => {
  switch (part.type) {
    case "data-om-observation-start": {
      if (hasCompletedOmCycle(messageParts, part.data.cycleId)) {
        return null;
      }

      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "observation",
            operationType: part.data.operationType,
            status: "pending",
          })}
          status="pending"
        />
      );
    }
    case "data-om-observation-end": {
      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "observation",
            operationType: part.data.operationType,
            status: "success",
          })}
          observations={part.data.observations}
          status="success"
        />
      );
    }
    case "data-om-observation-failed": {
      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "observation",
            operationType: part.data.operationType,
            status: "error",
          })}
          observations={part.data.observations}
          status="error"
        />
      );
    }
    case "data-om-buffering-start": {
      if (hasCompletedOmCycle(messageParts, part.data.cycleId)) return null;

      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "buffering",
            operationType: part.data.operationType,
            status: "pending",
          })}
          status="pending"
        />
      );
    }
    case "data-om-buffering-end": {
      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "buffering",
            operationType: part.data.operationType,
            status: "success",
          })}
          observations={part.data.observations}
          status="success"
        />
      );
    }
    case "data-om-buffering-failed": {
      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "buffering",
            operationType: part.data.operationType,
            status: "error",
          })}
          observations={part.data.observations}
          status="error"
        />
      );
    }
    case "data-om-activation": {
      return (
        <OmIndicator
          label={renderOmLabel({
            kind: "activation",
            status: "success",
          })}
          observations={part.data.observations}
          status="success"
        />
      );
    }
    default: {
      return null;
    }
  }
};
