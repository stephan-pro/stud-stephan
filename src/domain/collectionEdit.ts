// Changing the collection held in the app after saving or deleting (P6), with the same effects the
// server has (`fakeStore.ts`, the migrations): a deleted set leaves its figures with the catalog's
// "Stammt aus Set", a deleted diorama leaves its figures without a diorama.

import type { ObjectKind, ObjectOfKind, StoredObject } from "../backend/rules";
import type { Collection, Id, Minifig, ShowcaseItem } from "./types";

const LISTS = {
  minifig: "minifigs",
  legoSet: "sets",
  specialPart: "specialParts",
  diorama: "dioramas",
  wishItem: "wishlist",
} as const satisfies Record<ObjectKind, keyof Collection>;

/** Every list is sorted by id, as the server answers it. */
function byId<T extends { id: Id }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The collection with this object saved: replaces the one with its id, or is added. */
export function withSaved<K extends ObjectKind>(
  collection: Collection,
  kind: K,
  object: ObjectOfKind[K],
): Collection {
  const key = LISTS[kind];
  const list = collection[key] as { id: Id }[];
  const others = list.filter((entry) => entry.id !== object.id);
  return { ...collection, [key]: [...others, object].sort(byId) };
}

/** The same for an object of the showcase, whichever kind it is. */
export function withSavedItem(collection: Collection, item: ShowcaseItem): Collection {
  if (item.type === "minifig") return withSaved(collection, "minifig", item);
  if (item.type === "legoSet") return withSaved(collection, "legoSet", item);
  return withSaved(collection, "specialPart", item);
}

/**
 * Takes a deleted object back ("Rückgängig"): the object returns, and the figures that were linked
 * to it (`before` is the collection from before the deletion) get their link back. Other changes
 * made since stay.
 */
export function withRestored(
  collection: Collection,
  before: Collection,
  kind: ObjectKind,
  id: Id,
): Collection {
  const object = (before[LISTS[kind]] as ({ id: Id } & StoredObject)[]).find(
    (entry) => entry.id === id,
  );
  if (!object) return collection;
  const restored = withSaved(collection, kind, object as never);
  const linked = (figure: Minifig) =>
    kind === "diorama"
      ? figure.dioramaId === id
      : kind === "legoSet" && figure.fromSet?.setId === id;
  const wasLinked = new Set(before.minifigs.filter(linked).map((figure) => figure.id));
  return {
    ...restored,
    minifigs: restored.minifigs.map((figure) => {
      if (!wasLinked.has(figure.id)) return figure;
      if (kind === "diorama") return { ...figure, dioramaId: id };
      return { ...figure, fromSet: { ...figure.fromSet, setId: id } };
    }),
  };
}

/** The collection without this object, and the links to it removed. */
export function withoutObject(collection: Collection, kind: ObjectKind, id: Id): Collection {
  const key = LISTS[kind];
  const list = collection[key] as { id: Id }[];
  const rest = { ...collection, [key]: list.filter((entry) => entry.id !== id) };
  if (kind === "diorama") {
    return {
      ...rest,
      minifigs: rest.minifigs.map((minifig) => {
        if (minifig.dioramaId !== id) return minifig;
        const { dioramaId: _, ...without } = minifig;
        return without;
      }),
    };
  }
  if (kind === "legoSet") {
    return {
      ...rest,
      minifigs: rest.minifigs.map((minifig) => {
        if (minifig.fromSet?.setId !== id) return minifig;
        const { setId: _, ...fromSet } = minifig.fromSet;
        const { fromSet: __, ...without } = minifig;
        return Object.keys(fromSet).length === 0 ? without : { ...without, fromSet };
      }),
    };
  }
  return rest;
}
