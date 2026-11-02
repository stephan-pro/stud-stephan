import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Migrations reach the real project in two ways (SQL Editor, `db push`), and the history there may
// not know every file. So every migration after the ones below must be safe to run twice
// (docs/SUPABASE.md, "Datenbank ändern"). The files up to this one were written before the rule.
const LAST_UNGUARDED = "20261104120000_photo_focus.sql";

const DIRECTORY = "supabase/migrations";
const files = readdirSync(DIRECTORY)
  .filter((name) => name.endsWith(".sql"))
  .sort();

/** Statements that fail the second time unless they are guarded. */
const UNGUARDED = [
  /^\s*create\s+(table|index|unique index|trigger|extension|schema|type|policy)\s+(?!if not exists)/im,
  /^\s*create\s+function\b/im,
  /^\s*create\s+trigger\b/im,
  /^\s*alter\s+table\s+\S+\s+add\s+(column|constraint)\s+(?!if not exists)/im,
];

describe("Migrationen", () => {
  it("Dateinamen sind Zeitstempel in aufsteigender Reihenfolge", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) expect(name).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    expect(new Set(files.map((name) => name.slice(0, 14))).size).toBe(files.length);
  });

  it("Jede Migration nach photo_focus lässt sich gefahrlos zweimal ausführen", () => {
    for (const name of files.filter((file) => file > LAST_UNGUARDED)) {
      const sql = readFileSync(`${DIRECTORY}/${name}`, "utf8").replace(/--.*$/gm, "");
      for (const pattern of UNGUARDED) {
        expect(sql, `${name}: ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("Keine Migration löscht Tabellen oder Daten außerhalb von Funktionen", () => {
    for (const name of files) {
      const sql = readFileSync(`${DIRECTORY}/${name}`, "utf8")
        .replace(/--.*$/gm, "")
        .replace(/\$\$[\s\S]*?\$\$/g, "");
      expect(sql, name).not.toMatch(/^\s*(drop\s+table|truncate)\b/im);
    }
  });
});
