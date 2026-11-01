// Puts the example collection into the demo's store in memory, so that the demo's server holds what
// the demo shows: the export of the demo then contains the example collection, and an import has a
// state to replace. The example Studio files get a small stand-in file, since the demo has none.

import type { FakeStore } from "../backend/fakeStore";
import type { Collection } from "../domain/types";
import { SCHEMA_VERSION } from "../domain/types";

const STAND_IN = new TextEncoder().encode("Beispiel-Datei der Demo");

export function seedDemoStore(store: FakeStore, owner: string, collection: Collection): void {
  const save = (kind: string, objects: readonly object[]) => {
    for (const object of objects) store.save(owner, kind, object, SCHEMA_VERSION);
  };
  let number = 0;
  save(
    "diorama",
    collection.dioramas.map((diorama) => ({
      ...diorama,
      studioFiles: diorama.studioFiles.map((file) => ({
        ...file,
        path: store.putFile(
          owner,
          "studio-files",
          `demo/${++number}.io`,
          STAND_IN,
          "application/octet-stream",
        ),
        sizeBytes: STAND_IN.length,
      })),
    })),
  );
  save("legoSet", collection.sets);
  save("specialPart", collection.specialParts);
  save("minifig", collection.minifigs);
  save("wishItem", collection.wishlist);
  for (const point of collection.prices) store.savePrice(owner, point);
}
