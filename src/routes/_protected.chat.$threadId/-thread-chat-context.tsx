import type { Chat } from "@ai-sdk/react";
import { createContext } from "react";

import type { ThreadUIMessage } from "./-thread-types";

export const ThreadChatContext = createContext<Chat<ThreadUIMessage> | null>(
  null
);
