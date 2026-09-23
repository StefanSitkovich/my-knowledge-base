// Smallest single replacement that turns `prev` into `next`: common prefix and suffix are kept.
export interface TextDiff {
  start: number;
  /** End of the replaced range in `prev`. */
  end: number;
  insert: string;
}

export function textDiff(prev: string, next: string): TextDiff | undefined {
  if (prev === next) return undefined;
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  return { start, end: endPrev, insert: next.slice(start, endNext) };
}
