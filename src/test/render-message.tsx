import { render as rtlRender } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import { GTProvider } from "gt-tanstack-start";
import type { ReactElement, ReactNode } from "react";

import { MessageStateContext } from "@/routes/_protected.chat.$threadId/-message-state-context";

import { testTranslations } from "./translations";

type MessageRenderOptions = {
  isStreaming?: boolean;
} & Omit<RenderOptions, "wrapper">;

/** Render assistant message UI (GT + message streaming context). */
export const render = (
  ui: ReactElement,
  { isStreaming = false, ...renderOptions }: MessageRenderOptions = {},
) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <GTProvider locale="en" translations={testTranslations}>
        <MessageStateContext.Provider value={{ isStreaming }}>
          {children}
        </MessageStateContext.Provider>
      </GTProvider>
    ),
    ...renderOptions,
  });
