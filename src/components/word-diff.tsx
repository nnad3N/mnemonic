import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";
import type { WordDiffCounts } from "@/lib/word-diff";

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

type WordDiffStatsProps = {
  counts: WordDiffCounts;
  className?: string;
};

export const WordDiffStats = ({ counts, className }: WordDiffStatsProps) => (
  <div className={cn("flex shrink-0 gap-1.5 text-xs tabular-nums", className)}>
    <WordsAdded dimmed={counts.added === 0}>{counts.added}</WordsAdded>
    <WordsChanged dimmed={counts.replaced === 0}>{counts.replaced}</WordsChanged>
    <WordsRemoved dimmed={counts.removed === 0}>{counts.removed}</WordsRemoved>
  </div>
);
