import { panic } from "better-result";
import { use } from "react";

import { ComposerContext } from "../-thread-components/composer/composer-context";

export const useComposer = () => {
  const context = use(ComposerContext);

  if (!context) {
    panic("useComposer must be used within ComposerContext.Provider");
  }

  return context;
};
