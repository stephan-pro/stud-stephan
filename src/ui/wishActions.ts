// Saving and removing wishes (S9a): the server first, then the shown collection.

import { type Remote, RemoteError } from "../backend/remote";
import { withoutObject, withSaved } from "../domain/collectionEdit";
import type { WishItem } from "../domain/types";
import type { LoadedCollection } from "./useCollection";

export interface WishActions {
  save(wish: WishItem): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Changes to the wishlist; a failure is thrown, so the sheet can say so and keep the entries. */
export function wishActions(
  remote: Pick<Remote, "save" | "remove"> | undefined,
  update: LoadedCollection["update"],
): WishActions {
  const needRemote = () => {
    if (!remote) throw new RemoteError("Kein Server");
    return remote;
  };
  return {
    async save(wish) {
      await needRemote().save("wishItem", wish);
      update((collection) => withSaved(collection, "wishItem", wish));
    },
    async remove(id) {
      await needRemote().remove("wishItem", id);
      update((collection) => withoutObject(collection, "wishItem", id));
    },
  };
}
