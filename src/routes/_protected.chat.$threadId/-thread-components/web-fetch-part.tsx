import type { ToolUIPart } from "ai";

import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import { useExternalLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import type { ThreadUITools } from "@/routes/_protected.chat.$threadId/-thread-types";

type WebFetchToolPart = Extract<ToolUIPart<ThreadUITools>, { type: "tool-webFetch" }>;

type WebFetchPartProps = {
  part: WebFetchToolPart;
};

export const WebFetchPart = ({ part }: WebFetchPartProps) => {
  const { externalLinkModal, requestExternalLink } = useExternalLinkSafety();

  if (part.output?.type !== "success") {
    return <AssistantToolPart part={part} />;
  }

  const url = part.output.url;

  return (
    <>
      <AssistantToolPart interactive onClick={() => requestExternalLink(url)} part={part} />
      {externalLinkModal}
    </>
  );
};
