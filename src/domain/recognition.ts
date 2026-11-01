// Photo recognition (F1): how the hit rate of a suggestion is shown. Pure.

/** The score of a suggestion (0 to 1) as a whole percent: 0.918 → 92. Outside 0–100 it is clamped. */
export function scorePercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score * 100)));
}

/** "92 %" for a score of 0.918. */
export function formatScore(score: number): string {
  return `${scorePercent(score)} %`;
}
