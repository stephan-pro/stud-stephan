// OAuth 1.0a (HMAC-SHA1) signature for the BrickLink Store API, with Web Crypto so that it runs in
// the Edge Function (Deno) and in the tests (Node) alike.

export interface OAuthCredentials {
  consumerKey: string;
  consumerSecret: string;
  tokenValue: string;
  tokenSecret: string;
}

/** RFC 3986 percent-encoding (stricter than `encodeURIComponent`). */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

async function hmacSha1Base64(key: string, text: string): Promise<string> {
  const encoder = new TextEncoder();
  const imported = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", imported, encoder.encode(text)),
  );
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Builds the `Authorization` header for one request. `params` are the query parameters that belong
 * to the signature; `url` is the address without a query string.
 */
export async function oauthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: OAuthCredentials,
  nonce: string,
  timestamp: string,
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: credentials.tokenValue,
    oauth_version: "1.0",
  };
  const paramString = Object.entries({ ...params, ...oauthParams })
    .map(([key, value]) => [percentEncode(key), percentEncode(value)] as const)
    .sort(([keyA, valueA], [keyB, valueB]) =>
      keyA === keyB ? (valueA < valueB ? -1 : 1) : keyA < keyB ? -1 : 1,
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join(
    "&",
  );
  const signingKey = `${percentEncode(credentials.consumerSecret)}&${percentEncode(credentials.tokenSecret)}`;
  const fields = { ...oauthParams, oauth_signature: await hmacSha1Base64(signingKey, baseString) };
  return `OAuth ${Object.entries(fields)
    .map(([key, value]) => `${key}="${percentEncode(value)}"`)
    .join(", ")}`;
}
