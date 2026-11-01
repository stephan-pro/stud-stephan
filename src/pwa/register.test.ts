import { describe, expect, it } from "vitest";
import { SKIP_WAITING_MESSAGE } from "./register";
import { SKIP_WAITING } from "./swPolicy";

describe("P15 Neue Version nur nach „Neu laden“", () => {
  it("P15 Seite und Service Worker sprechen dieselbe Nachricht für „jetzt übernehmen“", () => {
    expect(SKIP_WAITING_MESSAGE).toBe(SKIP_WAITING);
  });
});
