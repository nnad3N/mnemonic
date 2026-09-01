import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type WordCountProps = PropsWithChildren<{ dimmed?: boolean }>;

export const WordsAdded = ({ children, dimmed }: WordCountProps) => (
  <span className={cn("text-f-green-600 dark:text-f-green-400", dimmed && "opacity-50")}>
    +{children}
  </span>
);

export const WordsChanged = ({ children, dimmed }: WordCountProps) => (
  <span className={cn("text-f-blue-600 dark:text-f-blue-400", dimmed && "opacity-50")}>
    ~{children}
  </span>
);

export const WordsRemoved = ({ children, dimmed }: WordCountProps) => (
  <span className={cn("text-f-red-600 dark:text-f-red-400", dimmed && "opacity-50")}>
    −{children}
  </span>
);
