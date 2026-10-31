// OAuth 1.0a (HMAC-SHA1) signature for the BrickLink Store API.
import { createHmac } from "node:crypto";

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

/**
 * Builds the `Authorization` header for one request. `params` are the query (and form) parameters
 * that belong to the signature; `url` is the address without a query string.
 */
export function oauthHeader(
  method: string,
  url: string,
  params: Record<string, string>,
  credentials: OAuthCredentials,
  nonce: string,
  timestamp: string,
): string {
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
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const fields = { ...oauthParams, oauth_signature: signature };
  return `OAuth ${Object.entries(fields)
    .map(([key, value]) => `${key}="${percentEncode(value)}"`)
    .join(", ")}`;
}
