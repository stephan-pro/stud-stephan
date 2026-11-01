/** A short id with no characters storage would refuse: "minifig-lq3x8k2f". */
export function newId(prefix: string): string {
  const random = Math.floor(Math.random() * 36 ** 6).toString(36);
  return `${prefix}-${Date.now().toString(36)}${random}`;
}

/** Today as "YYYY-MM-DD" in the device's time zone. */
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
