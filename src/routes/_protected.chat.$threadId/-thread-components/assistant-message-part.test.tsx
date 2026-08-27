import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { GTProvider } from "gt-tanstack-start";
import { describe, expect, it } from "vitest";

import { testTranslations } from "@/test/translations";

import { MessageStateContext } from "../-message-state-context";
import type { ThreadUIMessagePart } from "../-thread-types";
import { AssistantMessagePart } from "./assistant-message-part";

const renderTextPart = (markdown: string) => {
  const part: ThreadUIMessagePart = { type: "text", text: markdown };
  const rootRoute = createRootRoute({
    component: () => (
      <GTProvider locale="en" translations={testTranslations}>
        <MessageStateContext.Provider value={{ isStreaming: false }}>
          <AssistantMessagePart part={part} />
        </MessageStateContext.Provider>
      </GTProvider>
    ),
  });

  return render(
    <RouterProvider
      router={createRouter({
        history: createMemoryHistory({ initialEntries: ["/"] }),
        routeTree: rootRoute,
      })}
    />,
  );
};

describe("AssistantMessagePart", () => {
  it("renders a note mention link as a chip that opens the note", async () => {
    renderTextPart("See [My planning note](mention:note::gsvEZlkTFRmSaOFO3PJ2u) for details.");

    const mention = await screen.findByRole("link", { name: /My planning note/ });

    expect(mention).toHaveAttribute("href", expect.stringContaining("notes=true"));
    expect(mention).toHaveAttribute("href", expect.stringContaining("note=gsvEZlkTFRmSaOFO3PJ2u"));
  });

  it("keeps regular links on the default renderer with the safety modal", async () => {
    renderTextPart("Read the [docs](https://example.com) first.");

    const link = await screen.findByRole("button", { name: "docs" });

    expect(link).toHaveAttribute("data-streamdown", "link");
  });
});
