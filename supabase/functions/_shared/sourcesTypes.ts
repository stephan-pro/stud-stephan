// What the Edge Function `catalog` answers to `{op: "sources"}` (P14, S12 card "Datenquellen").
// Shared by the function and by the app, which only imports the types. Never carries a key.

export type SourceId = "rebrickable" | "bricklink" | "brickognize" | "merlin";

export const SOURCE_IDS: readonly SourceId[] = [
  "rebrickable",
  "bricklink",
  "brickognize",
  "merlin",
];

/**
 * ok = answers (with keys: they work); missingKeys = the project has no key for it;
 * refused = the service turned the key down; unreachable = no usable answer.
 */
export type SourceState = "ok" | "missingKeys" | "refused" | "unreachable";

export interface SourcesAnswer {
  op: "sources";
  sources: Record<SourceId, SourceState>;
}
