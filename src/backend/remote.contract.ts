// One series of tests for every `Remote`: the fakes in `npm run check` (`fakeRemote.test.ts`,
// `fakeHttpRemote.test.ts`) and `SupabaseRemote` against the real database in `npm run check:db`
// (`supabase/tests/contract.test.ts`). Each test gets two fresh, signed-in people A and B.

import { beforeEach, describe, expect, it } from "vitest";
import { figuresWithoutDiorama } from "../domain/dioramas";
import {
  aCollection,
  aDiorama,
  aMinifig,
  aPrice,
  aSet,
  aSpecialPart,
  aWish,
} from "../domain/fixtures";
import type { Minifig, StudioFile } from "../domain/types";
import type { Remote } from "./remote";
import { LIMITS, MAX_FILE_BYTES } from "./rules";

export interface ContractPeople {
  readonly a: Remote;
  readonly b: Remote;
}

/** Bytes 0…255 repeated, then random ones: every byte value, nothing a text step could keep. */
export function someBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index++) bytes[index] = index % 256;
  crypto.getRandomValues(bytes.subarray(256, Math.min(length, 256 + 65_536)));
  return bytes;
}

const WEBP = "image/webp";
const STUDIO = "application/octet-stream";

async function photo(remote: Remote, name: string): Promise<string> {
  return remote.putFile("photos", name, someBytes(1_000), WEBP);
}

/** The person's own folder, e.g. "1b9d…/" (taken from a file they store). */
async function ownFolder(remote: Remote): Promise<string> {
  const path = await photo(remote, "folder.webp");
  return path.slice(0, path.indexOf("/") + 1);
}

function aStudioFile(path: string, fields: Partial<StudioFile> = {}): StudioFile {
  return {
    id: `studio-${crypto.randomUUID()}`,
    fileName: "Umbara.io",
    sizeBytes: 300_000,
    uploadedAt: "2026-10-31T09:15:00Z",
    path,
    ...fields,
  };
}

export function describeRemoteContract(name: string, setup: () => Promise<ContractPeople>): void {
  describe(name, () => {
    let a: Remote;
    let b: Remote;

    beforeEach(async () => {
      ({ a, b } = await setup());
    });

    describe("Objekte", () => {
      it("Eine neue Person hat eine leere Sammlung", async () => {
        expect(await a.load()).toEqual(aCollection());
      });

      it("Jedes Objekt kommt beim Laden unverändert zurück", async () => {
        const figurePhoto = await photo(a, "minifig/rex-1.webp");
        const dioramaPhoto = await photo(a, "diorama/umbara-1.webp");
        const studioPath = await a.putFile(
          "studio-files",
          "diorama/umbara.io",
          someBytes(500),
          STUDIO,
        );
        const set = aSet({
          id: "set-a",
          purchasePrice: 2499,
          containedFigures: [{ name: "Clone Trooper", bricklinkId: "sw1234", quantity: 2 }],
        });
        const diorama = aDiorama({
          id: "diorama-a",
          photos: [dioramaPhoto],
          pieceCount: 1200,
          manualValue: { cents: 15000, enteredOn: "2026-10-20" },
          studioFiles: [aStudioFile(studioPath)],
        });
        const minifig = aMinifig({
          id: "minifig-a",
          photos: [figurePhoto],
          purchasePrice: 1250,
          fromSet: { label: "75372-1", setId: set.id },
          dioramaId: diorama.id,
          note: "Helm leicht verkratzt – „Rex“",
          mods: [{ id: "mod-1", position: "arms", description: "Bedruckte Arme", price: 500 }],
        });
        const part = aSpecialPart({ id: "part-a", kind: "gwp", number: "5008818" });
        const wish = aWish({ id: "wish-a", targetPrice: 2000, priority: "high" });
        const price = aPrice("sw0194", "2026-10-26", { new: 1800, used: 1200 });

        await a.save("legoSet", set);
        await a.save("diorama", diorama);
        await a.save("minifig", minifig);
        await a.save("specialPart", part);
        await a.save("wishItem", wish);
        await a.savePrice({ ...price, soldCount: { new: 4, used: 11 } });

        expect(await a.load()).toEqual(
          aCollection({
            minifigs: [minifig],
            sets: [set],
            specialParts: [part],
            dioramas: [diorama],
            wishlist: [wish],
            prices: [{ ...price, soldCount: { new: 4, used: 11 } }],
          }),
        );
      });

      it("Speichern mit derselben Kennung ersetzt das Objekt", async () => {
        await a.save("minifig", aMinifig({ id: "rex", condition: "used", note: "alt" }));
        const changed = aMinifig({ id: "rex", condition: "new" });
        await a.save("minifig", changed);

        expect((await a.load()).minifigs).toEqual([changed]);
      });

      it("Listen sind nach Kennung sortiert, Fotos bleiben in ihrer Reihenfolge", async () => {
        const first = await photo(a, "z.webp");
        const second = await photo(a, "a.webp");
        await a.save("minifig", aMinifig({ id: "b" }));
        await a.save("minifig", aMinifig({ id: "c", photos: [first, second] }));
        await a.save("minifig", aMinifig({ id: "a" }));

        const { minifigs } = await a.load();
        expect(minifigs.map((minifig) => minifig.id)).toEqual(["a", "b", "c"]);
        expect(minifigs[2]?.photos).toEqual([first, second]);
      });

      it("Ein Foto, das das Objekt nicht mehr nennt, wird aus dem Speicher gelöscht", async () => {
        const kept = await photo(a, "kept.webp");
        const dropped = await photo(a, "dropped.webp");
        await a.save("legoSet", aSet({ id: "set", photos: [dropped, kept] }));
        await a.save("legoSet", aSet({ id: "set", photos: [kept] }));

        expect((await a.load()).sets[0]?.photos).toEqual([kept]);
        expect(await a.getFile("photos", kept)).toHaveLength(1_000);
        await expect(a.getFile("photos", dropped)).rejects.toMatchObject({ reason: "not_found" });
      });

      it("Löschen entfernt das Objekt mit seinen Fotos", async () => {
        const cover = await photo(a, "coin.webp");
        await a.save("specialPart", aSpecialPart({ id: "coin", photos: [cover] }));
        await a.save("wishItem", aWish({ id: "wish" }));
        await a.remove("specialPart", "coin");
        await a.remove("wishItem", "wish");

        expect(await a.load()).toEqual(aCollection());
        await expect(a.getFile("photos", cover)).rejects.toMatchObject({ reason: "not_found" });
      });

      it("F8 Diorama löschen → zugeordnete Figuren bleiben erhalten und gelten wieder als „ohne Diorama“", async () => {
        const studioPath = await a.putFile("studio-files", "umbara.io", someBytes(800), STUDIO);
        await a.save("diorama", aDiorama({ id: "umbara", studioFiles: [aStudioFile(studioPath)] }));
        await a.save("minifig", aMinifig({ id: "rex", dioramaId: "umbara" }));
        await a.save("minifig", aMinifig({ id: "cody", dioramaId: "umbara" }));
        expect(figuresWithoutDiorama(await a.load())).toEqual([]);

        await a.remove("diorama", "umbara");

        const collection = await a.load();
        expect(collection.dioramas).toEqual([]);
        expect(figuresWithoutDiorama(collection).map((minifig) => minifig.id)).toEqual([
          "cody",
          "rex",
        ]);
        await expect(a.getFile("studio-files", studioPath)).rejects.toMatchObject({
          reason: "not_found",
        });
      });

      it("Set löschen → Figuren bleiben, „Stammt aus Set“ bleibt ohne Verknüpfung", async () => {
        await a.save("legoSet", aSet({ id: "battle-pack" }));
        await a.save(
          "minifig",
          aMinifig({ id: "a", fromSet: { label: "75372-1", setId: "battle-pack" } }),
        );
        await a.save("minifig", aMinifig({ id: "b", fromSet: { setId: "battle-pack" } }));

        await a.remove("legoSet", "battle-pack");

        const [first, second] = (await a.load()).minifigs as [Minifig, Minifig];
        expect(first.fromSet).toEqual({ label: "75372-1" });
        expect(second).not.toHaveProperty("fromSet");
      });
    });

    describe("Dateien", () => {
      it("F8 Hochgeladene Studio-Datei herunterladen → die Datei ist byte-gleich mit dem Original", async () => {
        const original = someBytes(300_000);
        const path = await a.putFile("studio-files", "umbara/v1.io", original, STUDIO);
        await a.save("diorama", aDiorama({ id: "umbara", studioFiles: [aStudioFile(path)] }));

        const [diorama] = (await a.load()).dioramas;
        const downloaded = await a.getFile("studio-files", diorama?.studioFiles[0]?.path ?? "");
        expect(downloaded).toEqual(original);
      });

      it("Eine Datei gleichen Namens wird ersetzt", async () => {
        const path = await a.putFile("photos", "rex.webp", someBytes(10), WEBP);
        const again = await a.putFile("photos", "rex.webp", someBytes(20), WEBP);

        expect(again).toBe(path);
        expect(await a.getFile("photos", path)).toEqual(someBytes(20));
      });

      it("Eine gelöschte Datei ist weg", async () => {
        const path = await photo(a, "weg.webp");
        await a.removeFile("photos", path);

        await expect(a.getFile("photos", path)).rejects.toMatchObject({
          permanent: true,
          reason: "not_found",
        });
      });
    });

    describe("Preisstände", () => {
      it("Ein zweiter Abruf am selben Tag ersetzt den Stand dieses Tages", async () => {
        await a.savePrice(aPrice("sw0194", "2026-10-26", { used: 1200 }));
        await a.savePrice(aPrice("sw0194", "2026-10-26", { new: 1900, used: 1300 }));
        await a.savePrice(aPrice("sw0194", "2026-10-19", { used: 1100 }));
        await a.savePrice(aPrice("75372-1", "2026-10-26", { new: 2500 }, "legoSet"));

        expect((await a.load()).prices).toEqual([
          aPrice("75372-1", "2026-10-26", { new: 2500 }, "legoSet"),
          aPrice("sw0194", "2026-10-19", { used: 1100 }),
          aPrice("sw0194", "2026-10-26", { new: 1900, used: 1300 }),
        ]);
      });
    });

    describe("Ein zweiter Nutzer", () => {
      it("Ein zweiter Nutzer kann keine Zeile lesen oder schreiben", async () => {
        const mine = aMinifig({ id: "rex", dioramaId: "umbara" });
        await a.save("diorama", aDiorama({ id: "umbara" }));
        await a.save("minifig", mine);
        await a.save("legoSet", aSet({ id: "set" }));
        await a.save("specialPart", aSpecialPart({ id: "part" }));
        await a.save("wishItem", aWish({ id: "wish" }));
        await a.savePrice(aPrice("sw0194", "2026-10-26", { used: 1200 }));
        const before = await a.load();

        expect(await b.load()).toEqual(aCollection());

        const theirs = aMinifig({ id: "rex", name: "Fremd" });
        await b.save("minifig", theirs);
        await b.savePrice(aPrice("sw0194", "2026-10-26", { used: 1 }));
        await b.remove("diorama", "umbara");
        await b.remove("legoSet", "set");
        await b.remove("specialPart", "part");
        await b.remove("wishItem", "wish");

        expect(await a.load()).toEqual(before);
        expect(await b.load()).toEqual(
          aCollection({
            minifigs: [theirs],
            prices: [aPrice("sw0194", "2026-10-26", { used: 1 })],
          }),
        );
        await b.remove("minifig", "rex");
        expect(await a.load()).toEqual(before);
      });

      it("Ein zweiter Nutzer kann keine Datei lesen oder schreiben", async () => {
        const original = someBytes(2_000);
        const path = await a.putFile("photos", "rex.webp", original, WEBP);
        const studioPath = await a.putFile("studio-files", "umbara.io", original, STUDIO);

        await expect(b.getFile("photos", path)).rejects.toMatchObject({ permanent: true });
        await expect(b.getFile("studio-files", studioPath)).rejects.toMatchObject({
          permanent: true,
        });
        await b.removeFile("photos", path);
        await b.removeFile("studio-files", studioPath);
        await expect(b.save("minifig", aMinifig({ photos: [path] }))).rejects.toMatchObject({
          permanent: true,
          reason: "invalid_path",
        });
        await expect(
          b.save("diorama", aDiorama({ studioFiles: [aStudioFile(studioPath)] })),
        ).rejects.toMatchObject({ permanent: true, reason: "invalid_path" });

        // B's own file of the same name lies in B's folder, not on top of A's.
        const own = await b.putFile("photos", "rex.webp", someBytes(10), WEBP);
        expect(own).not.toBe(path);
        expect(await a.getFile("photos", path)).toEqual(original);
        expect(await a.getFile("studio-files", studioPath)).toEqual(original);
      });
    });

    describe("Grenzen", () => {
      it(`Mehr als ${LIMITS.photosPerObject} Fotos an einem Objekt werden abgelehnt`, async () => {
        const folder = await ownFolder(a);
        const photos = Array.from(
          { length: LIMITS.photosPerObject + 1 },
          (_, i) => `${folder}${i}.webp`,
        );
        await a.save("minifig", aMinifig({ id: "ok", photos: photos.slice(1) }));

        await expect(a.save("minifig", aMinifig({ photos }))).rejects.toMatchObject({
          permanent: true,
          reason: "too_many_photos",
        });
      });

      it("Ein Objekt über 32 KB wird abgelehnt", async () => {
        await expect(
          a.save("minifig", aMinifig({ note: "x".repeat(LIMITS.objectBytes + 1) })),
        ).rejects.toMatchObject({ permanent: true, reason: "too_large" });
      });

      it("Ein Objekt der falschen Art wird abgelehnt", async () => {
        const set = aSet() as unknown as Minifig;
        await expect(a.save("minifig", set)).rejects.toMatchObject({
          permanent: true,
          reason: "invalid_object",
        });
        expect(await a.load()).toEqual(aCollection());
      });

      it("Ein Foto über 2 MB wird abgelehnt", async () => {
        const tooLarge = new Uint8Array(MAX_FILE_BYTES.photos + 1);
        await expect(a.putFile("photos", "gross.webp", tooLarge, WEBP)).rejects.toMatchObject({
          permanent: true,
          reason: "file_too_large",
        });
      });

      it("Eine Datei im falschen Format wird abgelehnt", async () => {
        await expect(
          a.putFile("photos", "bild.gif", someBytes(100), "image/gif"),
        ).rejects.toMatchObject({ permanent: true, reason: "file_type" });
      });

      it("Ein ungültiger Dateiname wird abgelehnt", async () => {
        await expect(
          a.putFile("photos", "../fremd.webp", someBytes(10), WEBP),
        ).rejects.toMatchObject({ permanent: true, reason: "invalid_path" });
      });

      it("Ein ungültiger Preisstand wird abgelehnt", async () => {
        await expect(
          a.savePrice(aPrice("sw0194", "2026-02-30", { used: 1200 })),
        ).rejects.toMatchObject({ permanent: true, reason: "invalid_object" });
      });
    });
  });
}
