// The database side of building a series (P12): the queue of `supabase/migrations/…_series.sql`,
// reached through PostgREST with the service role key. Like the price run's queue it is not best
// effort: if the database fails, the call fails, and what was taken goes back into the queue after
// three minutes by itself.

import type { StoreSettings } from "./catalogStore.ts";
import { CatalogError, type Fetch, isRecord, list, num, str } from "./json.ts";
import type { SeriesDetail, SeriesFigureInfo, SeriesSummary } from "./seriesTypes.ts";

/** One set taken from the queue. */
export interface ClaimedSet {
  readonly seriesId: number;
  readonly setNumber: string;
  /** How often it was taken, this time included. */
  readonly attempts: number;
}

export type SetOutcome =
  | { readonly kind: "done"; readonly figures: readonly SeriesFigureInfo[] }
  | { readonly kind: "failed" }
  | { readonly kind: "retry" };

export interface SeriesStore {
  /**
   * Creates the series of a theme for the owner with these sets in the queue and answers it. If the
   * owner has one for the theme already, nothing new is made and that one is answered.
   */
  begin(
    owner: string,
    theme: { readonly id: number; readonly name: string },
    sets: readonly { readonly number: string; readonly name: string }[],
  ): Promise<SeriesSummary>;
  /** Up to `limit` open sets of open, not paused series, of one owner or of all (`undefined`). */
  claim(owner: string | undefined, limit: number): Promise<ClaimedSet[]>;
  finish(item: ClaimedSet, outcome: SetOutcome): Promise<void>;
  /** Puts taken sets back; with `pausedUntil` every open series waits until then. */
  release(items: readonly ClaimedSet[], pausedUntil?: string): Promise<void>;
  /** The person's series, the one opened last first. */
  summaries(owner: string): Promise<SeriesSummary[]>;
  summary(owner: string, id: number): Promise<SeriesSummary | null>;
  /** The series with the figures found so far; with `touch` it counts as "zuletzt geöffnet". */
  detail(owner: string, id: number, touch: boolean): Promise<SeriesDetail | null>;
  remove(owner: string, id: number): Promise<void>;
}

function figureOf(raw: unknown): SeriesFigureInfo[] {
  if (!isRecord(raw)) return [];
  const number = str(raw.number);
  const name = str(raw.name);
  if (number === undefined || name === undefined) return [];
  const imageUrl = str(raw.imageUrl);
  return [{ number, name, ...(imageUrl === undefined ? {} : { imageUrl }) }];
}

/** A summary as the database function builds it; nothing else is taken. */
export function readSummary(raw: unknown): SeriesSummary | null {
  if (!isRecord(raw)) return null;
  const id = num(raw.id);
  const themeId = num(raw.themeId);
  const name = str(raw.name);
  const createdAt = str(raw.createdAt);
  if (id === undefined || themeId === undefined || name === undefined || createdAt === undefined) {
    return null;
  }
  const finishedAt = str(raw.finishedAt);
  const pausedUntil = str(raw.pausedUntil);
  return {
    id,
    themeId,
    name,
    total: num(raw.total) ?? 0,
    done: num(raw.done) ?? 0,
    failed: num(raw.failed) ?? 0,
    figureCount: num(raw.figureCount) ?? 0,
    createdAt,
    openedAt: str(raw.openedAt) ?? createdAt,
    ...(finishedAt === undefined ? {} : { finishedAt }),
    ...(pausedUntil === undefined ? {} : { pausedUntil }),
  };
}

/** The sets of `series_claim`, read defensively. */
export function readClaimedSets(rows: unknown): ClaimedSet[] {
  if (!Array.isArray(rows)) throw new CatalogError("unavailable", "Warteschlange unlesbar");
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const seriesId = num(row.seriesId);
    const setNumber = str(row.setNumber);
    if (seriesId === undefined || setNumber === undefined) return [];
    return [{ seriesId, setNumber, attempts: num(row.attempts) ?? 1 }];
  });
}

export function supabaseSeriesStore(settings: StoreSettings, send: Fetch): SeriesStore {
  const headers = {
    apikey: settings.serviceRoleKey,
    Authorization: `Bearer ${settings.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    let response: Response;
    try {
      response = await send(`${settings.url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(args),
      });
    } catch (error) {
      throw new CatalogError("unavailable", `Datenbank nicht erreichbar: ${String(error)}`);
    }
    if (!response.ok) {
      throw new CatalogError("unavailable", `Datenbank: ${name} mit HTTP ${response.status}`);
    }
    const text = await response.text();
    return text === "" ? null : (JSON.parse(text) as unknown);
  }

  const keys = (item: ClaimedSet) => ({ seriesId: item.seriesId, setNumber: item.setNumber });

  return {
    async begin(owner, theme, sets) {
      const answer = await rpc("series_begin", {
        p_owner: owner,
        p_theme_id: theme.id,
        p_name: theme.name,
        p_sets: sets.map((set) => ({ number: set.number, name: set.name })),
      });
      const summary = readSummary(answer);
      if (!summary) throw new CatalogError("unavailable", "Reihe konnte nicht angelegt werden");
      return summary;
    },

    async claim(owner, limit) {
      return readClaimedSets(await rpc("series_claim", { p_owner: owner ?? null, p_limit: limit }));
    },

    async finish(item, outcome) {
      await rpc("series_finish", {
        p_series: item.seriesId,
        p_set: item.setNumber,
        p_outcome: outcome.kind,
        p_figures: outcome.kind === "done" ? outcome.figures : null,
      });
    },

    async release(items, pausedUntil) {
      await rpc("series_release", {
        p_items: items.map(keys),
        p_paused_until: pausedUntil ?? null,
      });
    },

    async summaries(owner) {
      const rows = list(await rpc("series_list", { p_owner: owner }));
      return rows.flatMap((row) => readSummary(row) ?? []);
    },

    async summary(owner, id) {
      const rows = list(await rpc("series_list", { p_owner: owner }));
      for (const row of rows) {
        const summary = readSummary(row);
        if (summary?.id === id) return summary;
      }
      return null;
    },

    async detail(owner, id, touch) {
      const answer = await rpc("series_open", { p_owner: owner, p_series: id, p_touch: touch });
      if (!isRecord(answer)) return null;
      const summary = readSummary(answer.summary);
      if (!summary) return null;
      return { summary, figures: list(answer.figures).flatMap(figureOf) };
    },

    async remove(owner, id) {
      await rpc("series_remove", { p_owner: owner, p_series: id });
    },
  };
}
