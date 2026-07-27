import { createContext } from "react";

export type ComposerContextValue = {
  registerPortal: (element: HTMLElement | null) => void | (() => void);
};

export const ComposerContext = createContext<ComposerContextValue | null>(null);
