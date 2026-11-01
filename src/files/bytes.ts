/** 0 → "0 B", 1536 → "1,5 KB", 250 000 000 → "250 MB", 1 000 000 000 → "1 GB" (steps of 1,000). */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const rounded = unit === 0 ? String(Math.round(value)) : value.toFixed(value < 10 ? 1 : 0);
  return `${rounded.replace(".", ",").replace(/,0$/, "")} ${units[unit]}`;
}
