import { createCodePlugin } from "@streamdown/code";
import { createMathPlugin, type MathPlugin } from "@streamdown/math";
import { createMermaidPlugin } from "@streamdown/mermaid";
import { Link } from "@tanstack/react-router";
import { isToolUIPart } from "ai";
import type { Root, RootContent } from "mdast";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import remarkMathExtended from "remark-math-extended";
import { defaultRemarkPlugins, Streamdown } from "streamdown";
import type { Components } from "streamdown";

import { setNoteSearchOpen } from "@/components/notes-editor/use-open-note";
import { parseMentionKey } from "@/lib/mention-key";
import { useMessageState } from "@/routes/_protected.chat.$threadId/-hooks/use-message-state";
import { AssistantReasoningPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-reasoning-part";
import { AssistantToolPart } from "@/routes/_protected.chat.$threadId/-thread-components/assistant-tool-part";
import {
  MentionContent,
  MentionIcon,
  MentionLabel,
  MentionRoot,
} from "@/routes/_protected.chat.$threadId/-thread-components/composer/mention";
import { ComputePart } from "@/routes/_protected.chat.$threadId/-thread-components/compute-part.tsx";
import { OmPart } from "@/routes/_protected.chat.$threadId/-thread-components/om-part";
import { streamdownLinkSafety } from "@/routes/_protected.chat.$threadId/-thread-components/streamdown-link-safety-modal";
import { WebFetchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-fetch-part";
import { WebSearchPart } from "@/routes/_protected.chat.$threadId/-thread-components/web-search-part";
import type { ThreadUIMessagePart } from "@/routes/_protected.chat.$threadId/-thread-types";

const MENTION_URL_PREFIX = "mention:";

const renameNoteMentions = (node: Root | RootContent) => {
  if (node.type === "link" && node.url.startsWith(MENTION_URL_PREFIX)) {
    const mention = parseMentionKey(decodeURIComponent(node.url.slice(MENTION_URL_PREFIX.length)));

    if (mention.type === "note") {
      node.data = { hName: "note-mention", hProperties: { noteid: mention.value } };
    }

    return;
  }

  if ("children" in node) {
    node.children.forEach(renameNoteMentions);
  }
};

const remarkNoteMention = () => renameNoteMentions;

const responseRemarkPlugins = [...Object.values(defaultRemarkPlugins), remarkNoteMention];

type ResponseNoteMentionProps = {
  children?: ReactNode;
  noteid?: string;
};

const ResponseNoteMention = ({ children, noteid }: ResponseNoteMentionProps) => {
  if (noteid === undefined) {
    return <>{children}</>;
  }

  return (
    <MentionRoot render={<Link search={setNoteSearchOpen(noteid)} to="." />}>
      <MentionContent>
        <MentionIcon variant="note" />
        <MentionLabel>{children}</MentionLabel>
      </MentionContent>
    </MentionRoot>
  );
};

const responseComponents: Components = {
  // SAFETY: remarkNoteMention sets noteid to a string and the component guards the attribute-less
  // raw-HTML case; the index signature is just untyped per tag.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  "note-mention": ResponseNoteMention as Components[string],
};

const responseAllowedTags = { "note-mention": ["noteid"] };

const streamdownPlugins = {
  code: createCodePlugin(),
  math: {
    ...createMathPlugin(),
    // SAFETY: remark-math-extended + options match MathPlugin's remarkPlugin tuple shape.
    remarkPlugin: [
      remarkMathExtended,
      { backslashDelimiters: true, singleDollarTextMath: false },
    ] as MathPlugin["remarkPlugin"],
  },
  mermaid: createMermaidPlugin(),
};

type AssistantMessagePartProps = {
  part: ThreadUIMessagePart;
};

export const AssistantMessagePart = ({ part }: AssistantMessagePartProps) => {
  const { isStreaming } = useMessageState();
  const { resolvedTheme } = useTheme();

  // oxlint-disable-next-line typescript/switch-exhaustiveness-check
  switch (part.type) {
    case "text": {
      return (
        <Streamdown
          allowedTags={responseAllowedTags}
          components={responseComponents}
          isAnimating={isStreaming}
          linkSafety={streamdownLinkSafety}
          mermaid={{
            config: {
              theme: resolvedTheme === "dark" ? "dark" : "default",
            },
          }}
          plugins={streamdownPlugins}
          remarkPlugins={responseRemarkPlugins}
        >
          {part.text}
        </Streamdown>
      );
    }
    case "reasoning": {
      return <AssistantReasoningPart part={part} />;
    }
    case "tool-webSearch": {
      return <WebSearchPart part={part} />;
    }
    case "tool-webFetch": {
      return <WebFetchPart part={part} />;
    }
    case "tool-compute": {
      return <ComputePart part={part} />;
    }
    case "tool-recall": {
      return <AssistantToolPart part={part} />;
    }
    case "data-om-observation-start":
    case "data-om-observation-end":
    case "data-om-observation-failed":
    case "data-om-buffering-start":
    case "data-om-buffering-end":
    case "data-om-buffering-failed":
    case "data-om-activation": {
      return <OmPart part={part} />;
    }

    default: {
      if (isToolUIPart(part)) {
        return <AssistantToolPart part={part} />;
      }

      return null;
    }
  }
};
