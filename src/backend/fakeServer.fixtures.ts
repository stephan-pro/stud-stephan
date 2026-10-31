// Test building block: a `fetch` that hands requests straight to a `FakeServer` in the same
// process, without HTTP, so unit tests can turn its clock (`FakeServerOptions.auth.now`).

import type { FakeServer } from "./fakeServer";

export function fetchFrom(server: FakeServer): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const answer = server.handle({
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      token: request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? undefined,
      contentType: request.headers.get("Content-Type") ?? undefined,
      body: new Uint8Array(await request.arrayBuffer()),
    });
    if ("bytes" in answer) {
      return new Response(answer.bytes as Uint8Array<ArrayBuffer>, {
        status: answer.status,
        headers: { "Content-Type": answer.contentType },
      });
    }
    return Response.json(answer.json, { status: answer.status });
  }) as typeof fetch;
}
