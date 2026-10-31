// `npm run try:sources` – asks Rebrickable, Brickognize, BrickLink and Merlins Steine what they
// really deliver (P2). Keys come from .env.local and are never printed: the summary is scrubbed.
// `npm run try:sources -- --merlin=<Adresse einer SetDB-Seite>` skips the question for the address.

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { formatSummary } from "../src/sources/report.ts";
import {
  checkBrickLink,
  checkBrickognize,
  checkMerlin,
  checkRebrickable,
} from "../src/sources/steps.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const env = (name) => process.env[name]?.trim() || undefined;
const secrets = Object.entries(process.env)
  .filter(
    ([name, value]) =>
      /(KEY|SECRET|TOKEN)/.test(name) && /^(REBRICKABLE|BRICKLINK)_/.test(name) && value,
  )
  .map(([, value]) => value.trim());

const bricklinkKeys = {
  consumerKey: env("BRICKLINK_CONSUMER_KEY"),
  consumerSecret: env("BRICKLINK_CONSUMER_SECRET"),
  tokenValue: env("BRICKLINK_TOKEN_VALUE"),
  tokenSecret: env("BRICKLINK_TOKEN_SECRET"),
};
const bricklink = Object.values(bricklinkKeys).every(Boolean) ? bricklinkKeys : undefined;

function findPhoto() {
  for (const name of ["minifig.jpg", "minifig.jpeg", "minifig.png"]) {
    const path = `scripts/samples/${name}`;
    if (existsSync(path)) return { bytes: new Uint8Array(readFileSync(path)), fileName: name };
  }
  return undefined;
}

async function askForAddress() {
  const given = process.argv.find((arg) => arg.startsWith("--merlin="));
  if (given) return given.slice("--merlin=".length).trim();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "\nAdresse einer Seite von https://www.merlinssteine.de/setdb/ (Enter = überspringen): ",
  );
  rl.close();
  return answer.trim();
}

console.log("Prüfe Rebrickable, Brickognize und BrickLink … (dauert etwa eine halbe Minute)");
const results = [];
results.push(await checkRebrickable(fetch, env("REBRICKABLE_API_KEY")));
results.push(await checkBrickognize(fetch, findPhoto()));
results.push(
  await checkBrickLink(fetch, bricklink, () => ({
    nonce: randomBytes(16).toString("hex"),
    timestamp: String(Math.floor(Date.now() / 1000)),
  })),
);

const address = await askForAddress();
const merlin = await checkMerlin(fetch, address || undefined);
results.push(merlin.result);

const today = new Date().toISOString().slice(0, 10);
const summary = formatSummary(results, secrets, today);
mkdirSync("test-results/sources", { recursive: true });
writeFileSync("test-results/sources/summary.md", summary);
if (merlin.html) writeFileSync("test-results/sources/merlin-page.html", merlin.html);

console.log(
  `\n${"=".repeat(60)}\nAb hier kopieren und in den Chat einfügen (enthält keine Schlüssel):\n${"=".repeat(60)}\n`,
);
console.log(summary);
console.log("Die Zusammenfassung liegt auch in test-results/sources/summary.md.");
