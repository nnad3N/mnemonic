import { diffWords } from "diff";

export type WordDiffCounts = {
  added: number;
  removed: number;
  replaced: number;
};

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

const countWords = (value: string) => {
  let count = 0;

  for (const segment of wordSegmenter.segment(value)) {
    if (segment.isWordLike) {
      count++;
    }
  }

  return count;
};

export const diffWordCounts = (base: string, target: string): WordDiffCounts => {
  const parts = diffWords(base, target, { intlSegmenter: wordSegmenter });
  const counts = { added: 0, removed: 0, replaced: 0 };

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const next = parts.at(index + 1);

    if (part.removed && next?.added) {
      const removedWords = countWords(part.value);
      const addedWords = countWords(next.value);

      counts.replaced += Math.min(removedWords, addedWords);
      counts.added += Math.max(addedWords - removedWords, 0);
      counts.removed += Math.max(removedWords - addedWords, 0);
      index++;
      continue;
    }

    if (part.added) counts.added += countWords(part.value);
    if (part.removed) counts.removed += countWords(part.value);
  }

  return counts;
};
