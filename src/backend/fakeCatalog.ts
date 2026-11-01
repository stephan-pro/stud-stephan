// `Catalog` from a list of entries in memory: the demo and the end-to-end tests. Finds by number
// (also without the "-1" of a set) or by a part of the name, like the real function does for the
// two kinds of query. Can be cut off (`online = false`) or told to fail.

import {
  type Catalog,
  CatalogCallError,
  type CatalogHit,
  type CatalogItem,
  type CatalogKind,
  type SourceId,
  type SourceState,
} from "./catalog";

function hitOf(item: CatalogItem): CatalogHit {
  return {
    kind: item.kind,
    ref: item.number,
    number: item.number,
    name: item.name,
    ...(item.year === undefined ? {} : { year: item.year }),
    ...(item.theme === undefined ? {} : { theme: item.theme }),
    ...(item.imageUrl === undefined ? {} : { imageUrl: item.imageUrl }),
  };
}

export class FakeCatalog implements Catalog {
  /** When false, every call fails as without a connection. */
  online = true;
  /** When set, every call fails with this reason. */
  failure: "unavailable" | "limit_reached" | undefined;
  /** Every call, newest last, to check what the page asked for. */
  readonly calls: string[] = [];

  /**
   * `control` is asked before every call and can make it fail; the end-to-end tests use it (the
   * fake build reads it from the device's storage) because the page cannot reach this object.
   */
  constructor(
    private readonly items: readonly CatalogItem[],
    private readonly control: () => "offline" | "unavailable" | "limit_reached" | undefined = () =>
      undefined,
    /** Sources that are not "ok" (the end-to-end tests set them through the device's storage). */
    private readonly states: () => Partial<Record<SourceId, SourceState>> = () => ({}),
  ) {}

  async sources(): Promise<Record<SourceId, SourceState>> {
    this.calls.push("sources");
    this.check();
    return {
      rebrickable: "ok",
      bricklink: "ok",
      brickognize: "ok",
      merlin: "ok",
      ...this.states(),
    };
  }

  async search(kind: CatalogKind, query: string): Promise<CatalogHit[]> {
    this.calls.push(`search ${kind} ${query}`);
    this.check();
    const wanted = query.trim().toLowerCase();
    return this.items
      .filter((item) => item.kind === kind)
      .filter(
        (item) =>
          item.number.toLowerCase().startsWith(wanted) ||
          item.number.toLowerCase().replace(/-1$/, "") === wanted ||
          item.name.toLowerCase().includes(wanted),
      )
      .map(hitOf);
  }

  async item(kind: CatalogKind, ref: string): Promise<CatalogItem> {
    this.calls.push(`item ${kind} ${ref}`);
    this.check();
    const found = this.items.find((item) => item.kind === kind && item.number === ref);
    if (!found) throw new CatalogCallError("Nicht im Katalog", "not_found");
    return found;
  }

  private check(): void {
    const controlled = this.control();
    if (!this.online || controlled === "offline") {
      throw new CatalogCallError("Keine Verbindung", "offline");
    }
    const failure = this.failure ?? controlled;
    if (failure) throw new CatalogCallError("Dienst gestört", failure);
  }
}
