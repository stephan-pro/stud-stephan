import { useEffect, useRef, useState } from "preact/hooks";
import { type Catalog, CatalogCallError, type CatalogItem } from "../../backend/catalog";
import type { PageFields } from "../../backend/linkPreview";
import type { Remote } from "../../backend/remote";
import type { CatalogFigure } from "../../domain/types";
import {
  newWishValues,
  type WishSource,
  wishableFigures,
  wishForFigure,
  wishForSource,
  wishSourceOfFigure,
  wishSourceOfItem,
  wishSourceOfPage,
  wishValuesOf,
} from "../../domain/wishForm";
import { routeHash, type WishType } from "../route";
import { TEXTS } from "../texts";
import type { LoadedCollection } from "../useCollection";
import { wishActions } from "../wishActions";
import { SetFiguresSheet } from "./SetFiguresSheet";
import { WishSheet } from "./WishSheet";

const T = TEXTS.wishCapture;

/** What was picked in the search or on the link page to become a wish (P15). */
export type WishPick =
  | {
      readonly kind: "catalog";
      readonly catalogKind: WishType;
      readonly ref: string;
      /** The pasted link the entry was reached by. */
      readonly link?: string | undefined;
    }
  | {
      readonly kind: "page";
      readonly type: WishType;
      readonly fields: PageFields;
      readonly link: string;
    };

type Found =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly message: string }
  | {
      readonly status: "ready";
      readonly source: WishSource;
      /** The catalog entry, for the figures of a set. */
      readonly item?: CatalogItem | undefined;
    };

/** What the picker shows: the figures of a set, one of them, or the wish for the entry itself. */
type View =
  | { readonly kind: "figures" }
  | { readonly kind: "figure"; readonly figure: CatalogFigure }
  | { readonly kind: "entry" };

const ENTRY: View = { kind: "entry" };

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
  const [view, setView] = useState<View>(ENTRY);
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
      (item) => {
        if (!active) return;
        setFound({ status: "ready", source: wishSourceOfItem(item, pick.link), item });
        setView(item.kind === "legoSet" && item.figures?.length ? { kind: "figures" } : ENTRY);
      },
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
  const { item } = found;
  const rows = item && collection ? wishableFigures(item, collection) : [];
  const hasFigures = rows.length > 0;
  const toWishlist = () => {
    location.hash = routeHash("wishlist");
  };

  if (item && view.kind === "figures") {
    return (
      <SetFiguresSheet
        item={item}
        rows={rows}
        setWished={existing !== undefined}
        onFigure={(figure) => setView({ kind: "figure", figure })}
        onSet={() => setView(ENTRY)}
        onClose={() => (saved.current ? toWishlist() : onClose())}
      />
    );
  }

  if (item && view.kind === "figure") {
    const wish = wishForFigure(collection?.wishlist ?? [], view.figure.bricklinkId);
    return (
      <WishSheet
        key={view.figure.bricklinkId ?? view.figure.name}
        source={wishSourceOfFigure(view.figure, { theme: item.theme })}
        initial={wish ? wishValuesOf(wish) : newWishValues("minifig")}
        existing={wish}
        prices={collection?.prices ?? []}
        actions={actions}
        // Back to the figures of the set, so more of them can be wished.
        onClose={() => setView({ kind: "figures" })}
      />
    );
  }

  return (
    <WishSheet
      source={found.source}
      initial={existing ? wishValuesOf(existing) : newWishValues(found.source.type)}
      existing={existing}
      prices={collection?.prices ?? []}
      actions={actions}
      onClose={() => {
        if (saved.current) toWishlist();
        else if (hasFigures) setView({ kind: "figures" });
        else onClose();
      }}
    />
  );
}
