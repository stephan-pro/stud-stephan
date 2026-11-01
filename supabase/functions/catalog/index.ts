// Edge Function `catalog` (P7): search by number or name and the full catalog entry of a minifig or
// set. Logic and tests are in `../_shared/`. Deployed with `--no-verify-jwt`: the function checks
// the sign-in itself (`isSignedIn`), which also works with the project's newer keys.
import { catalogHandlerDeps } from "../_shared/environment.ts";
import { handleCatalog } from "../_shared/handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const deps = catalogHandlerDeps((name) => Deno.env.get(name), fetch);
Deno.serve((request) => handleCatalog(request, deps));
