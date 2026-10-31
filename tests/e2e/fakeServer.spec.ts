import { expect, test } from "@playwright/test";
import { FAKE_SERVER } from "./helpers";

// The fake server runs next to the app and the browser reaches it from the app's address (CORS),
// as the end-to-end tests from P4b on need it. Its rules are covered by the contract tests.

test("Die App erreicht den Fake-Server aus dem Browser", async ({ page }) => {
  await page.goto("./");

  const collection = await page.evaluate(async (server) => {
    const account = (await (await fetch(`${server}/test/user`, { method: "POST" })).json()) as {
      token: string;
    };
    const headers = {
      Authorization: `Bearer ${account.token}`,
      "Content-Type": "application/json",
    };
    const figure = {
      type: "minifig",
      id: "rex",
      name: "Captain Rex",
      manufacturer: { kind: "lego" },
      condition: "used",
      photos: [],
      links: [],
      mods: [],
      createdAt: "2026-10-01T10:00:00Z",
    };
    await fetch(`${server}/objects/minifig?schemaVersion=1`, {
      method: "POST",
      headers,
      body: JSON.stringify(figure),
    });
    return (await (await fetch(`${server}/collection`, { headers })).json()) as {
      minifigs: { name: string }[];
    };
  }, FAKE_SERVER);

  expect(collection.minifigs.map((minifig) => minifig.name)).toEqual(["Captain Rex"]);
});
