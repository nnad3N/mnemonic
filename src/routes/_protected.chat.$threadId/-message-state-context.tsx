import { createContext } from "react";

type MessageStateContextValue = {
  isStreaming: boolean;
};

export const MessageStateContext = createContext<MessageStateContextValue | null>(null);
