import MarkdownIt from "markdown-it";

const markdownIt = new MarkdownIt();

export const markdownToText = (markdown: string): string => {
  const parts: string[] = [];

  for (const token of markdownIt.parse(markdown, {})) {
    if (token.type === "inline") {
      parts.push(
        token.children
          ?.filter((child) => child.type === "text" || child.type === "code_inline")
          .map((child) => child.content)
          .join("") ?? "",
      );
      continue;
    }

    if (token.type === "fence" || token.type === "code_block") {
      parts.push(token.content);
    }
  }

  return parts.join("\n");
};
