// The database side of the functions: a cache of catalog answers (30 days) and the count of the
// day's BrickLink calls (limit 5,000 a day). The tables are closed to the app and open only to the
// service role (`supabase/migrations/…_catalog.sql`), which the functions use through PostgREST.
// Both are best effort: if the database does not answer, the function works without cache.

import type { Fetch } from "./json.ts";

export interface CatalogStore {
  /** The value stored under `key` since `notBefore` (ISO time), else nothing. */
  read(key: string, notBefore: string): Promise<unknown>;
  write(key: string, value: unknown, now: string): Promise<void>;
  /** Counts one call of the service for the day; `false` once `cap` calls are used up. */
  countCall(service: string, day: string, cap: number): Promise<boolean>;
}

export interface StoreSettings {
  /** e.g. "https://<project>.supabase.co" */
  readonly url: string;
  readonly serviceRoleKey: string;
}

export function supabaseStore(settings: StoreSettings, send: Fetch): CatalogStore {
  const headers = {
    apikey: settings.serviceRoleKey,
    Authorization: `Bearer ${settings.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  const rest = `${settings.url}/rest/v1`;
  return {
    async read(key, notBefore) {
      try {
        const query = `key=eq.${encodeURIComponent(key)}&fetched_at=gte.${encodeURIComponent(notBefore)}&select=value`;
        const response = await send(`${rest}/catalog_cache?${query}`, { headers });
        if (!response.ok) return undefined;
        const rows: unknown = await response.json();
        return Array.isArray(rows) && rows[0] && typeof rows[0] === "object"
          ? (rows[0] as { value?: unknown }).value
          : undefined;
      } catch {
        return undefined;
      }
    },

    async write(key, value, now) {
      try {
        await send(`${rest}/catalog_cache`, {
          method: "POST",
          headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ key, value, fetched_at: now }),
        });
      } catch {
        // No cache this time; the answer is still good.
      }
    },

    async countCall(service, day, cap) {
      try {
        const response = await send(`${rest}/rpc/catalog_count_call`, {
          method: "POST",
          headers,
          body: JSON.stringify({ p_service: service, p_day: day, p_cap: cap }),
        });
        if (!response.ok) return true;
        return (await response.json()) !== false;
      } catch {
        return true;
      }
    },
  };
}
