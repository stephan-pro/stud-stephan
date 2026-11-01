// Series as the app sees them (P12, F13): finding a theme, what building it costs, building it and
// the figures of the finished ones, all answered by the Edge Function `bricklink`
// (`{op: "series"}`). `SupabaseSeriesBuilder` is the real one, `FakeSeriesBuilder`
// (`fakeSeriesBuilder.ts`) answers from a few example themes in the demo and the end-to-end tests.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SeriesAnswer,
  SeriesDetail,
  SeriesPlan,
  SeriesRequest,
  SeriesSearch,
  SeriesSummary,
} from "../../supabase/functions/_shared/seriesTypes";
import { CatalogCallError, failureOf } from "./catalog";

export type {
  SeriesDetail,
  SeriesFigureInfo,
  SeriesPlan,
  SeriesSearch,
  SeriesSummary,
  SeriesTheme,
} from "../../supabase/functions/_shared/seriesTypes";
export {
  SERIES_MAX_SETS,
  SERIES_WARNING_SETS,
} from "../../supabase/functions/_shared/seriesTypes";

/** A failed call is a `CatalogCallError`: offline, unavailable, limit, sign-in, unknown theme. */
export type SeriesCallError = CatalogCallError;

export interface SeriesBuilder {
  /**
   * The themes whose name has every word of the text, or the theme of a set or minifig number.
   * A main theme with sub themes comes first and cannot be chosen; its sub themes follow it.
   */
  search(query: string): Promise<SeriesSearch>;
  /** How many sets (= BrickLink calls) building the series of the theme takes. */
  plan(themeId: number): Promise<SeriesPlan>;
  /** Creates the series (or finds the one there is) and queues its sets. */
  start(themeId: number): Promise<SeriesSummary>;
  /**
   * Works on the person's open series for a while and answers the state of this one; called again
   * while sets are left and the build is not paused.
   */
  work(id: number): Promise<SeriesSummary>;
  /** The person's series, the one opened last first. */
  list(): Promise<SeriesSummary[]>;
  /**
   * The series with the figures found so far (or null). With `touch` (opening it) it counts as
   * "zuletzt geöffnet"; the list only reads, so it passes `false`.
   */
  get(id: number, touch: boolean): Promise<SeriesDetail | null>;
  remove(id: number): Promise<void>;
}

/** The sets of a series are still to do and the day's limit does not hold the build back. */
export function seriesOpen(summary: SeriesSummary): boolean {
  return summary.finishedAt === undefined && summary.pausedUntil === undefined;
}

/** Sets that were asked about (done or failed). */
export function seriesAsked(summary: SeriesSummary): number {
  return summary.done + summary.failed;
}

export class SupabaseSeriesBuilder implements SeriesBuilder {
  constructor(private readonly client: Pick<SupabaseClient, "functions">) {}

  async search(query: string): Promise<SeriesSearch> {
    const answer = await this.call({ op: "series", action: "search", query });
    if (answer.action !== "search" || !Array.isArray(answer.themes)) throw this.unreadable();
    return { themes: answer.themes, more: answer.more === true };
  }

  async plan(themeId: number): Promise<SeriesPlan> {
    const answer = await this.call({ op: "series", action: "plan", themeId });
    if (answer.action !== "plan") throw this.unreadable();
    return answer.plan;
  }

  async start(themeId: number): Promise<SeriesSummary> {
    const answer = await this.call({ op: "series", action: "start", themeId });
    if (answer.action !== "start") throw this.unreadable();
    return answer.summary;
  }

  async work(id: number): Promise<SeriesSummary> {
    const answer = await this.call({ op: "series", action: "work", id });
    if (answer.action !== "work") throw this.unreadable();
    return answer.summary;
  }

  async list(): Promise<SeriesSummary[]> {
    const answer = await this.call({ op: "series", action: "list" });
    if (answer.action !== "list") throw this.unreadable();
    return answer.series;
  }

  async get(id: number, touch: boolean): Promise<SeriesDetail | null> {
    const answer = await this.call({ op: "series", action: "get", id, touch });
    if (answer.action !== "get") throw this.unreadable();
    return answer.detail;
  }

  async remove(id: number): Promise<void> {
    const answer = await this.call({ op: "series", action: "remove", id });
    if (answer.action !== "remove") throw this.unreadable();
  }

  private unreadable(): CatalogCallError {
    return new CatalogCallError("bricklink: unlesbare Antwort", "unavailable");
  }

  private async call(request: SeriesRequest): Promise<SeriesAnswer> {
    const { data, error } = await this.client.functions.invoke("bricklink", { body: request });
    if (error) throw await failureOf(error, "bricklink");
    const answer = data as SeriesAnswer | null;
    if (!answer || typeof answer.action !== "string") throw this.unreadable();
    return answer;
  }
}
