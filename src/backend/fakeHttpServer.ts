// HTTP in front of `FakeServer`, with Node's own server: what `scripts/fake-server.ts` starts for
// the end-to-end tests and the unit tests of `FakeHttpRemote` start on a free port. Test-only:
// wide-open CORS, nothing is kept after the process ends.

import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { FakeServer } from "./fakeServer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function readBody(request: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    request.on("error", reject);
  });
}

export interface RunningFakeServer {
  /** e.g. "http://localhost:4180" */
  readonly url: string;
  readonly server: FakeServer;
  close(): Promise<void>;
}

/** Starts the fake server; port 0 takes a free one. */
export function startFakeHttpServer(port: number): Promise<RunningFakeServer> {
  const fake = new FakeServer();
  const http = createServer(async (request, response) => {
    const method = request.method ?? "GET";
    if (method === "OPTIONS") {
      response.writeHead(204, CORS);
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    const authorization = request.headers.authorization;
    const answer = fake.handle({
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      token: authorization?.replace(/^Bearer /, ""),
      contentType: request.headers["content-type"],
      body: await readBody(request),
    });
    if ("bytes" in answer) {
      response.writeHead(answer.status, { ...CORS, "Content-Type": answer.contentType });
      response.end(Buffer.from(answer.bytes));
    } else {
      response.writeHead(answer.status, { ...CORS, "Content-Type": "application/json" });
      response.end(JSON.stringify(answer.json));
    }
  });
  return new Promise((resolve) => {
    http.listen(port, () => {
      const { port: actual } = http.address() as AddressInfo;
      resolve({
        url: `http://localhost:${actual}`,
        server: fake,
        close: () =>
          new Promise((done) => {
            http.closeAllConnections();
            http.close(() => done());
          }),
      });
    });
  });
}
