import type { TranscriptionWordResponse } from "../../types";

export function activeTranscriptWordIndex(words: TranscriptionWordResponse[], currentTime: number) {
  let low = 0;
  let high = words.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (words[middle].start_seconds <= currentTime) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (candidate < 0) return -1;
  const word = words[candidate];
  if (currentTime < word.end_seconds) return candidate;
  const next = words[candidate + 1];
  return next && currentTime < next.start_seconds ? candidate : -1;
}

export function wordNeedsLeadingSpace(text: string, index: number) {
  if (index === 0) return false;
  return !/^[,.;:!?%)\]}»”’…]/u.test(text);
}
