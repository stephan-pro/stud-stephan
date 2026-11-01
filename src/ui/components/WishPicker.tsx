import { useEffect, useRef, useState } from "preact/hooks";
import { type Catalog, CatalogCallError, type CatalogKind } from "../../backend/catalog";
import type { PageFields } from "../../backend/linkPreview";
import type { Remote } from "../../backend/remote";
import {
  newWishValues,
  type WishSource,
  wishForSource,
  wishSourceOfItem,
  wishSourceOfPage,
  wishValuesOf,
} from "../../domain/wishForm";
import { routeHash } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";
import { wishActions } from "../wishActions";
import { WishSheet } from "./WishSheet";

const T = TEXTS.wishCapture;

/** What was picked in the search or on the link page to become a wish (P15). */
export type WishPick =
  | {
      readonly kind: "catalog";
      readonly catalogKind: CatalogKind;
      readonly ref: string;
      /** The pasted link the entry was reached by. */
      readonly link?: string | undefined;
    }
  | {
      readonly kind: "page";
      readonly type: CatalogKind;
      readonly fields: PageFields;
      readonly link: string;
    };

type Found =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "ready"; readonly source: WishSource };

function failureMessage(error: unknown): string {
  const failure = error instanceof CatalogCallError ? error.failure : "unavailable";
  if (failure === "offline") return T.failed.offline;
  if (failure === "limit_reached") return T.failed.limit_reached;
  if (failure === "not_found") return T.failed.not_found;
  return T.failed.unavailable;
}

/**
 * A wish from the capture sheet (P15): a catalog entry (number, search, Rebrickable/BrickLink link)
 * is fetched first, a read page is used as it is; then the wish sheet (S9a) opens. A wish with the
 * same number that is already on the list opens instead of a second one. Saving leads to the
 * wishlist.
 */
export function WishPicker({
  pick,
  data,
  remote,
  catalog,
  onClose,
}: {
  readonly pick: WishPick;
  readonly data: LoadedCollection;
  readonly remote: Remote | undefined;
  readonly catalog: Catalog | undefined;
  readonly onClose: () => void;
}) {
  const [found, setFound] = useState<Found>(() =>
    pick.kind === "page"
      ? { status: "ready", source: wishSourceOfPage(pick.type, pick.fields, pick.link) }
      : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  /** Whether the sheet saved (or removed) the wish; closing then leads to the wishlist. */
  const saved = useRef(false);

  useEffect(() => {
    if (pick.kind !== "catalog") return;
    let active = true;
    setFound({ status: "loading" });
    const fetched = catalog
      ? catalog.item(pick.catalogKind, pick.ref)
      : Promise.reject(new CatalogCallError("Kein Katalog", "unavailable"));
    fetched.then(
      (item) => active && setFound({ status: "ready", source: wishSourceOfItem(item, pick.link) }),
      (error: unknown) => active && setFound({ status: "failed", message: failureMessage(error) }),
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (found.status === "loading") {
    return (
      <p class="search-results__status" role="status" aria-busy="true">
        {T.loading}
      </p>
    );
  }
  if (found.status === "failed") {
    return (
      <div class="card" role="alert">
        <p class="card__text">{found.message}</p>
        <button
          type="button"
          class="button button--secondary pressable"
          onClick={() => setAttempt((count) => count + 1)}
        >
          {T.retry}
        </button>
      </div>
    );
  }

  const collection = data.state.status === "ready" ? data.state.collection : undefined;
  const existing = collection ? wishForSource(collection.wishlist, found.source) : undefined;
  const base = wishActions(remote, data.update);
  const actions = {
    save: async (wish: Parameters<typeof base.save>[0]) => {
      await base.save(wish);
      saved.current = true;
    },
    remove: async (id: string) => {
      await base.remove(id);
      saved.current = true;
    },
  };
  return (
    <WishSheet
      source={found.source}
      initial={existing ? wishValuesOf(existing) : newWishValues(found.source.type)}
      existing={existing}
      prices={collection?.prices ?? []}
      actions={actions}
      onClose={() => {
        if (saved.current) location.hash = routeHash("wishlist");
        else onClose();
      }}
    />
  );
}
