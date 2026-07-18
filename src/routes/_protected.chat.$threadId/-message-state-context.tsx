import { createContext } from "react";

type MessageStateContextValue = {
  isAnimating: boolean;
};

export const MessageStateContext = createContext<MessageStateContextValue | null>(null);
