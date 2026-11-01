// Edge Function `recognize` (P8): sends the photo of a figure to Brickognize and answers with up to
// five suggestions. Logic and tests are in `../_shared/`. Deployed with `--no-verify-jwt`: the
// function checks the sign-in itself (`isSignedIn`), like `catalog` and `bricklink`.
import { recognizeHandlerDeps } from "../_shared/environment.ts";
import { handleRecognize } from "../_shared/handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const deps = recognizeHandlerDeps((name) => Deno.env.get(name), fetch);
Deno.serve((request) => handleRecognize(request, deps));
