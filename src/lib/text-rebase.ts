import { diff3Merge } from "node-diff3";

export const rebaseText = (base: string, mine: string, theirs: string): string => {
  const regions = diff3Merge(mine.split("\n"), base.split("\n"), theirs.split("\n"), {
    excludeFalseConflicts: true,
  });

  const lines: string[] = [];

  for (const region of regions) {
    if (region.ok) {
      lines.push(...region.ok);
    }

    if (region.conflict) {
      lines.push(...region.conflict.b);
    }
  }

  return lines.join("\n");
};
