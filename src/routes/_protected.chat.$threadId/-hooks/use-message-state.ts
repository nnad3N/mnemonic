import { panic } from "better-result";
import { use } from "react";

import { MessageStateContext } from "../-message-state-context";

export const useMessageState = () => {
  const context = use(MessageStateContext);

  if (!context) {
    panic("useMessageState must be used within MessageStateContext.Provider");
  }

  return context;
};
