// Fetching one page for `link-preview` (P9). The function fetches an address a person pasted, so
// everything that could turn it into a way into the server's own network is closed here (decision
// of 01.11.2026, docs/UMSETZUNG.md section 7):
// - only http and https, only port 80 and 443, no login in the address;
// - no IP address as host, no `localhost` and no internal names; the name is also looked up and
//   refused if it leads to a private or internal address, for every redirect again;
// - at most 3 redirects, each one followed by hand and checked like the first address;
// - none of the headers or cookies of the request are passed on: the headers are fixed here;
// - 10 seconds for everything, 2 MB for the page, and only `text/html` is read.

import type { Fetch } from "./json.ts";
import { LinkError, MAX_LINK_LENGTH } from "./linkTypes.ts";

export const PAGE_LIMITS = {
  redirects: 3,
  timeoutMs: 10_000,
  maxBytes: 2_000_000,
} as const;

/** The only ports a page may be fetched from; the default port of the scheme counts as one. */
const PORTS: readonly string[] = ["", "80", "443"];

/** Names of the private side of a network, whatever they resolve to. */
const INTERNAL_SUFFIXES: readonly string[] = [
  "localhost",
  "local",
  "localdomain",
  "internal",
  "intranet",
  "private",
  "lan",
  "home",
  "corp",
  "home.arpa",
  "in-addr.arpa",
  "ip6.arpa",
];

/** Fixed request headers: nothing of the caller's request goes along, and no cookies. */
const REQUEST_HEADERS: Readonly<Record<string, string>> = {
  Accept: "text/html",
  "Accept-Language": "de,en;q=0.5",
  "User-Agent": "StudStephan-LinkPreview/1.0 (+https://stephan-pro.github.io/stud-stephan/)",
};

function blocked(reason: string): LinkError {
  return new LinkError("blocked", reason);
}

function unreachable(reason: string): LinkError {
  return new LinkError("unreachable", reason);
}

/** Whether a host is an IP address in any spelling (the URL parser turns `0x7f.1` into `127.0.0.1`). */
function isIpHost(host: string): boolean {
  return host.startsWith("[") || host.includes(":") || /^[0-9.]+$/.test(host);
}

/**
 * The address as a URL if the function may fetch it, else a `blocked` error. This is the check that
 * needs no network; `assertPublicHost` adds the look-up of the name.
 */
export function checkAddress(raw: string): URL {
  if (raw.length > MAX_LINK_LENGTH) throw blocked("Adresse zu lang");
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw blocked("Keine Adresse");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw blocked("Nur http und https");
  if (url.username !== "" || url.password !== "") throw blocked("Keine Anmeldung in der Adresse");
  if (!PORTS.includes(url.port)) throw blocked("Nur Port 80 und 443");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIpHost(host)) throw blocked("Keine IP-Adresse");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) throw blocked("Kein öffentlicher Rechnername");
  if (INTERNAL_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    throw blocked("Interner Name");
  }
  // A real top-level domain has letters ("de", "xn--p1ai"); "example.123" is no name.
  if (!/^([a-z]{2,}|xn--[a-z0-9-]+)$/.test(host.slice(host.lastIndexOf(".") + 1))) {
    throw blocked("Kein öffentlicher Rechnername");
  }
  return url;
}

/** The eight 16-bit groups of an IPv6 address, or nothing if it is not one. */
function ipv6Groups(address: string): number[] | undefined {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  // "::ffff:1.2.3.4": the tail in dotted form is two groups.
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const parts = dotted.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return undefined;
    const [a = 0, b = 0, c = 0, d = 0] = parts;
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined;
  const groups = [...head, ...(halves.length === 2 ? Array(missing).fill("0") : []), ...tail];
  const numbers = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : -1));
  return numbers.length === 8 && numbers.every((number) => number >= 0) ? numbers : undefined;
}

function isPrivateV4(a: number, b: number, c: number): boolean {
  return (
    a === 0 || // "this" network
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a === 127 ||
    (a === 169 && b === 254) || // link-local, also the cloud metadata address
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Whether an IP address (v4 or v6) is not a public one: private, loopback, link-local, reserved. */
export function isPrivateAddress(address: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (v4) {
    const [a = 0, b = 0, c = 0, d = 0] = v4.slice(1).map(Number);
    return a > 255 || b > 255 || c > 255 || d > 255 || isPrivateV4(a, b, c);
  }
  const groups = ipv6Groups(address);
  // Something that is neither is not trusted.
  if (!groups) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const zeros = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
  // "::", "::1" and the old "::a.b.c.d" are never a public host.
  if (zeros && g5 === 0) return true;
  if (zeros && g5 === 0xffff) return isPrivateV4(g6 >> 8, g6 & 255, g7 >> 8); // IPv4-mapped
  if (g0 === 0x64 && g1 === 0xff9b) return true; // NAT64: leads to the v4 side, not trusted
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (retired)
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x2002) return true; // 6to4: embeds a v4 address, not trusted
  return false;
}

/** Looks up the IP addresses of a name (A and AAAA). */
export type Resolve = (host: string) => Promise<string[]>;

async function assertPublicHost(host: string, resolve: Resolve): Promise<void> {
  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    throw unreachable("Rechnername nicht gefunden");
  }
  if (addresses.length === 0) throw unreachable("Rechnername nicht gefunden");
  // One private answer is enough to refuse: the fetch could pick exactly that one.
  if (addresses.some(isPrivateAddress)) throw blocked("Führt in ein internes Netz");
}

export interface PageDeps {
  readonly fetch: Fetch;
  readonly resolve: Resolve;
  /** Smaller limits for tests. */
  readonly limits?: Partial<{ redirects: number; timeoutMs: number; maxBytes: number }>;
}

export interface FetchedPage {
  readonly html: string;
  /** The address the page was finally read from, after the redirects. */
  readonly url: URL;
}

function charsetOf(contentType: string): string {
  return /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType)?.[1] ?? "utf-8";
}

function decode(bytes: Uint8Array, contentType: string): string {
  try {
    return new TextDecoder(charsetOf(contentType)).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** The body up to `maxBytes`; stops reading (and fails) at the first byte beyond. */
async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw unreachable("Seite zu groß");
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw unreachable("Seite zu groß");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return all;
}

/**
 * Reads the HTML page at `start`: follows up to 3 redirects by hand, checks every address (also
 * the name's look-up), gives up after 10 seconds or 2 MB and accepts only `text/html`.
 */
export async function fetchPage(deps: PageDeps, start: URL): Promise<FetchedPage> {
  const limits = { ...PAGE_LIMITS, ...deps.limits };
  const signal = AbortSignal.timeout(limits.timeoutMs);
  let current = start;
  try {
    for (let redirects = 0; ; redirects++) {
      await assertPublicHost(current.hostname.toLowerCase().replace(/\.$/, ""), deps.resolve);
      const response = await deps.fetch(current.href, {
        method: "GET",
        headers: REQUEST_HEADERS,
        redirect: "manual",
        credentials: "omit",
        signal,
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => {});
        const location = response.headers.get("Location");
        if (!location) throw unreachable("Weiterleitung ohne Ziel");
        if (redirects >= limits.redirects) throw unreachable("Zu viele Weiterleitungen");
        // The target is checked like an address the person pasted.
        current = checkAddress(new URL(location, current).href);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        throw unreachable(`Antwort ${response.status}`);
      }
      const contentType = response.headers.get("Content-Type") ?? "";
      if (!/^text\/html\b/i.test(contentType.trim())) {
        await response.body?.cancel().catch(() => {});
        throw unreachable("Keine HTML-Seite");
      }
      const bytes = await readLimited(response, limits.maxBytes);
      return { html: decode(bytes, contentType), url: current };
    }
  } catch (error) {
    if (error instanceof LinkError) throw error;
    // Timeout, refused connection, broken answer: all "the page does not answer".
    throw unreachable(error instanceof Error ? error.message : "Seite nicht erreichbar");
  }
}
