import { describe, expect, it } from "vitest";
import { oauthHeader, percentEncode } from "./oauth.ts";

// Published example values of the OAuth 1.0a documentation (not real keys).
const EXAMPLE_CONSUMER = "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw";
const EXAMPLE_TOKEN = "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE";

describe("OAuth 1.0a signature for BrickLink", () => {
  it("signs the documented example request correctly (HMAC-SHA1, RFC 5849 rules)", () => {
    const header = oauthHeader(
      "POST",
      "https://api.twitter.com/1.1/statuses/update.json",
      {
        include_entities: "true",
        status: "Hello Ladies + Gentlemen, a signed OAuth request!",
      },
      {
        consumerKey: "xvz1evFS4wEEPTGEFPHBog",
        consumerSecret: EXAMPLE_CONSUMER,
        tokenValue: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        tokenSecret: EXAMPLE_TOKEN,
      },
      "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
      "1318622958",
    );
    const signature = /oauth_signature="([^"]+)"/.exec(header)?.[1];
    expect(decodeURIComponent(signature ?? "")).toBe("hCtSmYh+iHYCEqBWrE7C7hYmtUk=");
  });

  it("encodes reserved characters strictly", () => {
    expect(percentEncode("a b!'()*~")).toBe("a%20b%21%27%28%29%2A~");
  });

  it("puts all OAuth fields into the header and never the secrets", () => {
    const header = oauthHeader(
      "GET",
      "https://api.bricklink.com/x",
      {},
      { consumerKey: "ck", consumerSecret: "geheim1", tokenValue: "tv", tokenSecret: "geheim2" },
      "n",
      "1",
    );
    expect(header).toContain('oauth_consumer_key="ck"');
    expect(header).toContain('oauth_token="tv"');
    expect(header).not.toContain("geheim");
  });
});
