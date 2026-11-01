// Edge Function `bricklink`: the BrickLink catalog calls on their own (P7) and the price run (P11):
// called by the cron job (header `x-price-run-secret`, secret `PRICE_RUN_SECRET`) and by the app's
// "Jetzt aktualisieren". Logic and tests are in `../_shared/`. Deployed with `--no-verify-jwt` like
// `catalog`: the function checks the sign-in (or the secret) itself.
import { bricklinkHandlerDeps } from "../_shared/environment.ts";
import { handleBricklink } from "../_shared/handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const deps = bricklinkHandlerDeps((name) => Deno.env.get(name), fetch);
Deno.serve((request) => handleBricklink(request, deps));
