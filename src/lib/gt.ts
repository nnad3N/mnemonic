import type { useGT } from "gt-tanstack-start";

/** Translator from `useGT()` — pass into helpers that live outside React components. */
export type GT = ReturnType<typeof useGT>;
