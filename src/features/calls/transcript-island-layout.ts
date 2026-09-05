export type TranscriptBounds = { left: number; right: number; top: number; bottom: number };

export function transcriptIslandLayout(card: TranscriptBounds, clip: TranscriptBounds, toggleTop: number, buttonHeight: number) {
  const coordinates = [card.left, card.right, card.top, card.bottom, clip.left, clip.right, clip.top, clip.bottom, toggleTop, buttonHeight];
  if (!coordinates.every(Number.isFinite) || buttonHeight <= 0) return null;
  const left = Math.max(card.left, clip.left) + 12;
  const right = Math.min(card.right, clip.right) - 12;
  const bottom = clip.bottom - 10;
  const top = Math.max(card.top, clip.top);
  if (right - left < 140 || bottom - top < buttonHeight + 16 || card.bottom < bottom || toggleTop <= bottom) return null;
  return {
    left: (left + right) / 2,
    bottom,
    maxWidth: right - left,
    collision: Math.min(1, Math.max(0, (96 - (toggleTop - bottom)) / 96)),
  };
}
