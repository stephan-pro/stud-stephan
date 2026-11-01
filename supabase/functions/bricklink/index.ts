// Edge Function `bricklink` (P7): the BrickLink catalog calls on their own; P11 adds the price guide.
// Logic and tests are in `../_shared/`. Deployed with `--no-verify-jwt` like `catalog`.
import { bricklinkHandlerDeps } from "../_shared/environment.ts";
import { handleBricklink } from "../_shared/handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const deps = bricklinkHandlerDeps((name) => Deno.env.get(name), fetch);
Deno.serve((request) => handleBricklink(request, deps));
