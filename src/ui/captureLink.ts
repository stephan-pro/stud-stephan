// What was read from the pasted link (S7c), kept for the form that follows, so the page is not
// fetched a second time. Lives in memory only; the shell lets go of it when the person leaves that
// way of capturing. A form opened by address alone (a reload) simply reads the link again.

import type { LinkAnswer } from "../backend/linkPreview";

let held: { address: string; answer: LinkAnswer } | undefined;

export const CaptureLink = {
  hold(address: string, answer: LinkAnswer): void {
    held = { address, answer };
  },
  /** The answer for exactly this address, if it was read just now. */
  peek(address: string): LinkAnswer | undefined {
    return held?.address === address ? held.answer : undefined;
  },
  clear(): void {
    held = undefined;
  },
};
