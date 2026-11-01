import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { aMinifig, aPrice } from "../../src/domain/fixtures";
import { SCHEMA_VERSION } from "../../src/domain/types";
import { admin, anonymous, type Person, signedIn, sql } from "./setup";

// Only Stephan reads and writes his data (P4a, N7). Checked with direct requests to the API, as
// someone with the public key and an account of their own would send them, past the app.

const TABLES = [
  "minifigs",
  "lego_sets",
  "special_parts",
  "dioramas",
  "wish_items",
  "photos",
  "studio_files",
  "price_points",
] as const;

/** The tables of the catalog functions (P7): closed to the app, open to the service role only. */
const CATALOG_TABLES = ["catalog_cache", "catalog_usage"] as const;

/** The queue of the price run (P11): the owner reads, only its functions write (`priceRun.test.ts`). */
const PRICE_RUN_TABLES = ["price_run_items", "price_runs"] as const;

const bytes = new Uint8Array([1, 2, 3, 4, 5]);

let owner: Person;
let stranger: Person;
let ownPhoto: string;
let ownStudioFile: string;

async function rows(client: SupabaseClient, table: string): Promise<unknown[]> {
  const { data } = await client.from(table).select("*");
  return data ?? [];
}

/** A row for the table as it would be written past the functions, claiming the owner. */
function rowFor(table: (typeof TABLES)[number], ownerId: string): Record<string, unknown> {
  switch (table) {
    case "photos":
      return {
        owner: ownerId,
        path: `${ownerId}/fremd.webp`,
        item_kind: "minifig",
        item_id: "x",
        position: 0,
      };
    case "studio_files":
      return {
        owner: ownerId,
        id: "fremd",
        diorama_id: "umbara",
        file_name: "fremd.io",
        size_bytes: 5,
        uploaded_at: "2026-10-31T09:15:00Z",
        path: `${ownerId}/fremd.io`,
        position: 0,
      };
    case "price_points":
      return {
        owner: ownerId,
        item_type: "minifig",
        bricklink_id: "sw0001",
        date: "2026-10-26",
        data: aPrice("sw0001", "2026-10-26", { used: 1 }),
      };
    default:
      return {
        owner: ownerId,
        id: "fremd",
        data: { id: "fremd", type: "minifig" },
        schema_version: SCHEMA_VERSION,
      };
  }
}

beforeAll(async () => {
  [owner, stranger] = await Promise.all([signedIn(), signedIn()]);
  ownPhoto = `${owner.id}/rex.webp`;
  ownStudioFile = `${owner.id}/umbara.io`;
  const client = owner.client;
  expect(
    (await client.storage.from("photos").upload(ownPhoto, bytes, { contentType: "image/webp" }))
      .error,
  ).toBeNull();
  expect(
    (
      await client.storage
        .from("studio-files")
        .upload(ownStudioFile, bytes, { contentType: "application/octet-stream" })
    ).error,
  ).toBeNull();
  const call = async (name: string, args: Record<string, unknown>) => {
    const { error } = await client.rpc(name, args);
    expect(error).toBeNull();
  };
  await call("save_object", {
    p_kind: "diorama",
    p_object: {
      type: "diorama",
      id: "umbara",
      name: "Umbara",
      photos: [],
      links: [],
      studioFiles: [
        {
          id: "studio-1",
          fileName: "umbara.io",
          sizeBytes: 5,
          uploadedAt: "2026-10-31T09:15:00Z",
          path: ownStudioFile,
        },
      ],
      createdAt: "2026-10-01T10:00:00Z",
    },
    p_schema_version: SCHEMA_VERSION,
  });
  for (const [kind, type] of [
    ["minifig", "minifig"],
    ["legoSet", "legoSet"],
    ["specialPart", "specialPart"],
    ["wishItem", "minifig"],
  ] as const) {
    await call("save_object", {
      p_kind: kind,
      p_object: { ...aMinifig({ id: "rex", photos: kind === "minifig" ? [ownPhoto] : [] }), type },
      p_schema_version: SCHEMA_VERSION,
    });
  }
  await call("save_price_point", { p_point: aPrice("sw0194", "2026-10-26", { used: 1200 }) });
  for (const table of TABLES) {
    expect((await rows(client, table)).length, table).toBeGreaterThan(0);
  }
});

describe("Ohne Anmeldung", () => {
  it("Ohne Anmeldung ist keine Zeile lesbar und keine schreibbar", async () => {
    const nobody = anonymous();
    for (const table of TABLES) {
      expect(await rows(nobody, table), table).toEqual([]);
      const { error } = await nobody.from(table).insert(rowFor(table, owner.id));
      expect(error, table).not.toBeNull();
    }
  });

  it("Ohne Anmeldung ist keine Funktion aufrufbar außer ping", async () => {
    const nobody = anonymous();
    for (const [name, args] of [
      ["load_collection", {}],
      ["save_object", { p_kind: "minifig", p_object: aMinifig(), p_schema_version: 1 }],
      ["delete_object", { p_kind: "minifig", p_id: "rex" }],
      ["save_price_point", { p_point: aPrice("sw0194", "2026-10-26", { used: 1 }) }],
    ] as const) {
      const { error } = await nobody.rpc(name, args);
      expect(error, name).not.toBeNull();
    }
    expect((await nobody.rpc("ping")).data).toBe(true);
  });

  it("Ohne Anmeldung ist keine Datei lesbar und keine schreibbar", async () => {
    const nobody = anonymous();
    for (const [bucket, path] of [
      ["photos", ownPhoto],
      ["studio-files", ownStudioFile],
    ] as const) {
      expect((await nobody.storage.from(bucket).download(path)).error, path).not.toBeNull();
      expect((await nobody.storage.from(bucket).list(owner.id)).data ?? []).toEqual([]);
      const upload = await nobody.storage
        .from(bucket)
        .upload(`${owner.id}/fremd`, bytes, { contentType: "application/octet-stream" });
      expect(upload.error, bucket).not.toBeNull();
    }
  });
});

describe("Ein zweiter Nutzer", () => {
  it("Ein zweiter Nutzer kann keine Zeile lesen", async () => {
    for (const table of TABLES) {
      expect(await rows(stranger.client, table), table).toEqual([]);
    }
    const { data } = await stranger.client.rpc("load_collection");
    expect(data).toEqual({
      minifigs: [],
      sets: [],
      specialParts: [],
      dioramas: [],
      wishlist: [],
      prices: [],
    });
  });

  it("Ein zweiter Nutzer kann keine Zeile schreiben, ändern oder löschen", async () => {
    const before = await Promise.all(TABLES.map((table) => rows(owner.client, table)));

    for (const table of TABLES) {
      const insert = await stranger.client.from(table).insert(rowFor(table, owner.id));
      expect(insert.error, `${table} anlegen`).not.toBeNull();
      const update = await stranger.client
        .from(table)
        .update({ owner: stranger.id })
        .eq("owner", owner.id)
        .select();
      expect(update.data ?? [], `${table} ändern`).toEqual([]);
      const remove = await stranger.client.from(table).delete().eq("owner", owner.id).select();
      expect(remove.data ?? [], `${table} löschen`).toEqual([]);
    }

    expect(await Promise.all(TABLES.map((table) => rows(owner.client, table)))).toEqual(before);
  });

  it("Ein zweiter Nutzer kann keine Datei lesen, schreiben oder löschen", async () => {
    for (const [bucket, path] of [
      ["photos", ownPhoto],
      ["studio-files", ownStudioFile],
    ] as const) {
      const files = stranger.client.storage.from(bucket);
      expect((await files.download(path)).error, `${path} laden`).not.toBeNull();
      expect((await files.list(owner.id)).data ?? [], `${bucket} auflisten`).toEqual([]);
      const contentType = bucket === "photos" ? "image/webp" : "application/octet-stream";
      const overwrite = await files.upload(path, new Uint8Array([9]), {
        contentType,
        upsert: true,
      });
      expect(overwrite.error, `${path} überschreiben`).not.toBeNull();
      const added = await files.upload(`${owner.id}/neu`, bytes, { contentType });
      expect(added.error, `${bucket} hinzufügen`).not.toBeNull();
      await files.remove([path]);

      const { data, error } = await owner.client.storage.from(bucket).download(path);
      expect(error).toBeNull();
      expect(new Uint8Array((await data?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(bytes);
    }
  });

  it("Eigene Dateien darf ein zweiter Nutzer nur in seinen eigenen Ordner legen", async () => {
    const files = stranger.client.storage.from("photos");
    const own = await files.upload(`${stranger.id}/eigen.webp`, bytes, {
      contentType: "image/webp",
    });
    expect(own.error).toBeNull();
    const root = await files.upload("lose.webp", bytes, { contentType: "image/webp" });
    expect(root.error).not.toBeNull();
  });
});

describe("Datenbank", () => {
  it("Jede Tabelle hat Row Level Security, und ohne Anmeldung gibt es keine Rechte", () => {
    const tables = sql(
      "select c.relname, c.relrowsecurity, has_table_privilege('anon', c.oid, 'select,insert,update,delete') " +
        "from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1",
    );
    expect(tables).toEqual(
      [...TABLES, ...CATALOG_TABLES, ...PRICE_RUN_TABLES].sort().map((table) => `${table}|t|f`),
    );
  });

  it("Katalog-Cache und Aufrufzähler sind für die App gesperrt, auch angemeldet", async () => {
    for (const client of [anonymous(), owner.client]) {
      for (const table of CATALOG_TABLES) {
        const read = await client.from(table).select("*");
        expect(read.data ?? [], table).toEqual([]);
        const write = await client.from(table).insert({ key: "x", value: {}, day: "2026-11-01" });
        expect(write.error, table).not.toBeNull();
      }
      const count = await client.rpc("catalog_count_call", {
        p_service: "bricklink",
        p_day: "2026-11-01",
        p_cap: 5,
      });
      expect(count.error).not.toBeNull();
    }
  });

  it("Der Aufrufzähler zählt bis zur Grenze und lehnt danach ab", async () => {
    const day = "2031-01-01";
    const call = async () =>
      (await admin.rpc("catalog_count_call", { p_service: "test", p_day: day, p_cap: 2 })).data;
    expect([await call(), await call(), await call(), await call()]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    const { data } = await admin.from("catalog_usage").select("calls").eq("day", day);
    expect(data).toEqual([{ calls: 2 }]);
  });

  it("Der Katalog-Cache speichert und ersetzt Antworten", async () => {
    const write = (value: unknown) =>
      admin.from("catalog_cache").upsert({ key: "item:test:1", value }, { onConflict: "key" });
    expect((await write({ name: "alt" })).error).toBeNull();
    expect((await write({ name: "neu" })).error).toBeNull();
    const { data } = await admin.from("catalog_cache").select("value").eq("key", "item:test:1");
    expect(data).toEqual([{ value: { name: "neu" } }]);
  });

  it("Ohne Anmeldung ist nur die Funktion ping ausführbar", () => {
    const functions = sql(
      "select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace " +
        "and has_function_privilege('anon', p.oid, 'execute') order by 1",
    );
    expect(functions).toEqual(["ping"]);
  });

  it("Beide Buckets sind privat und haben ihre Grenzen", () => {
    const buckets = sql(
      "select id, public, file_size_limit, array_to_string(allowed_mime_types, ',') " +
        "from storage.buckets where id in ('photos', 'studio-files') order by 1",
    );
    expect(buckets).toEqual([
      "photos|f|2097152|image/webp,image/jpeg,image/png",
      "studio-files|f|26214400|application/octet-stream",
    ]);
  });
});
