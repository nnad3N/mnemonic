import { createContext } from "react";

import type { createNoteBaselineStore } from "./notes-store";

export const NoteBaselineContext = createContext<ReturnType<
  typeof createNoteBaselineStore
> | null>(null);
