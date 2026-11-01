// Edge Function `link-preview` (P9): reads what a pasted address gives (Rebrickable or BrickLink
// number for the catalog, Merlins Steine page, title and picture of any other page). It fetches
// addresses of other people, so `../_shared/safeFetch.ts` limits it (public web pages only, no
// internal network, 3 redirects, 10 s, 2 MB, `text/html`). Logic and tests are in `../_shared/`.
// Deployed with `--no-verify-jwt`: the function checks the sign-in itself (`isSignedIn`).
import { linkHandlerDeps } from "../_shared/environment.ts";
import { handleLinkPreview } from "../_shared/handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  resolveDns(host: string, type: "A" | "AAAA"): Promise<string[]>;
  serve(handler: (request: Request) => Promise<Response>): void;
};

/** A and AAAA together; a name that has only one of them is fine, one with neither fails. */
async function resolve(host: string): Promise<string[]> {
  const [v4, v6] = await Promise.allSettled([
    Deno.resolveDns(host, "A"),
    Deno.resolveDns(host, "AAAA"),
  ]);
  return [
    ...(v4.status === "fulfilled" ? v4.value : []),
    ...(v6.status === "fulfilled" ? v6.value : []),
  ];
}

const deps = linkHandlerDeps((name) => Deno.env.get(name), fetch, resolve);
Deno.serve((request) => handleLinkPreview(request, deps));
