// Merlins Steine SetDB: the reader lives with the Edge Function `link-preview` (P9), which uses it
// on the server; `npm run try:sources` and its tests keep using it from here.
export {
  decodeEntities,
  extractSetPage,
  type MerlinFields,
  type MerlinResult,
} from "../../supabase/functions/_shared/pageParser.ts";
