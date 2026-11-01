// Builds the service worker (P15) without a library: `src/pwa/serviceWorker.ts` becomes `sw.js` next
// to index.html, with the list of the app's files and a version made from them. Runs in Node at
// build time only (`vite build`); the dev server and the fake server's own build get no service
// worker.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

const ENTRY = "src/pwa/serviceWorker.ts";
export const SERVICE_WORKER_FILE = "sw.js";

/**
 * Files not kept for offline: source maps, Vite's own notes, and fonts in the old WOFF format (every
 * browser of the app reads WOFF2; the WOFF files are only a fallback).
 */
export function isKept(file: string): boolean {
  return (
    file !== SERVICE_WORKER_FILE &&
    !file.endsWith(".map") &&
    !file.startsWith(".vite/") &&
    !/\.woff$/.test(file)
  );
}

/**
 * The list `sw.js` keeps: "./" (index.html, as the app is opened) and every other file, relative to
 * the scope. The version changes whenever a file changes (the names of built files carry a hash of
 * their content; index.html and the files of public/ are hashed here).
 */
export function precacheList(
  files: readonly string[],
  contentOf: (file: string) => string | Uint8Array,
): { files: string[]; version: string } {
  const list = [...new Set(files.filter(isKept))].sort();
  const hash = createHash("sha256");
  for (const file of list) {
    hash.update(file);
    hash.update(contentOf(file));
  }
  return {
    files: ["./", ...list.filter((file) => file !== "index.html")],
    version: hash.digest("hex").slice(0, 16),
  };
}

/**
 * Whether built code loads other files (`import … from "./…"`, `import("./…")`). A shared module
 * would end up as such a chunk, and a classic service worker cannot load it.
 */
export function importsOtherFiles(code: string): boolean {
  return /(^|[;}\s])import(\s*[{*"'`]|\s+[\w$])|\bimport\s*\(/.test(code);
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

export function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "stud-stephan:service-worker",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      if (config.build.ssr) return;
      this.emitFile({ type: "chunk", id: ENTRY, fileName: SERVICE_WORKER_FILE });
    },
    // After writing: every file is final (also index.html and the copies of public/).
    writeBundle(options) {
      if (config.build.ssr) return;
      const out = options.dir ?? config.build.outDir;
      const files = filesBelow(out).map((path) => relative(out, path).replaceAll("\\", "/"));
      const { files: list, version } = precacheList(files, (file) => readFileSync(join(out, file)));
      const path = join(out, SERVICE_WORKER_FILE);
      const code = readFileSync(path, "utf8");
      if (!code.includes("__PRECACHE__") || !code.includes("__SW_VERSION__")) {
        throw new Error(`${SERVICE_WORKER_FILE}: Platzhalter für Dateiliste oder Version fehlen`);
      }
      if (importsOtherFiles(code)) {
        throw new Error(
          `${SERVICE_WORKER_FILE} lädt andere Dateien (import): ein Service Worker muss für sich allein laufen. ` +
            "Die App darf nichts aus src/pwa/swPolicy.ts oder serviceWorker.ts importieren.",
        );
      }
      writeFileSync(
        path,
        code
          .replaceAll("__PRECACHE__", JSON.stringify(list))
          .replaceAll("__SW_VERSION__", JSON.stringify(version)),
      );
    },
  };
}
