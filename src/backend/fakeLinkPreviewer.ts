// `LinkPreviewer` from a list of example pages in memory: the demo and the end-to-end tests. Judges
// an address like the real function does (same address check, same reading of Rebrickable and
// BrickLink addresses), but never fetches: a page it does not know "does not answer".

import { catalogLink } from "../../supabase/functions/_shared/linkService";
import { LinkError } from "../../supabase/functions/_shared/linkTypes";
import { checkAddress } from "../../supabase/functions/_shared/safeFetch";
import {
  type LinkAnswer,
  LinkCallError,
  type LinkFailure,
  type LinkPreviewer,
} from "./linkPreview";

/** How the fake answers when told otherwise (the fake build reads it from the device's storage). */
export type LinkControl = "offline" | "unavailable" | "unreachable" | undefined;

export class FakeLinkPreviewer implements LinkPreviewer {
  /** When false, every call fails as without a connection. */
  online = true;
  /** Every address asked, newest last. */
  readonly calls: string[] = [];

  /** `pages` maps a full address to what the page gives. */
  constructor(
    private readonly pages: Readonly<Record<string, LinkAnswer>>,
    private readonly control: () => LinkControl = () => undefined,
  ) {}

  async preview(address: string): Promise<LinkAnswer> {
    this.calls.push(address);
    const mode = this.control();
    if (!this.online || mode === "offline") throw new LinkCallError("Keine Verbindung", "offline");
    if (mode === "unavailable" || mode === "unreachable") {
      throw new LinkCallError("Dienst gestört", mode satisfies LinkFailure);
    }
    let url: URL;
    try {
      url = checkAddress(address);
    } catch (error) {
      if (error instanceof LinkError) throw new LinkCallError(error.message, error.failure);
      throw error;
    }
    const known = catalogLink(url);
    if (known) return known;
    const page = this.pages[url.href];
    if (!page) throw new LinkCallError("Seite antwortet nicht", "unreachable");
    return page;
  }
}
