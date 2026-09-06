"use client";

import * as React from "react";
import type { AnalyticsRange } from "@/lib/api";

/**
 * What the overview cards have on screen, as a tiny external store the
 * poster reads from (feature_candidates §6).
 *
 * The rule the poster lives by is "never a number the card does not show",
 * and the cheapest way to keep it is structural: the stat row, the revenue
 * tile and the chart each publish the data they just rendered, and the
 * modal draws from that rather than fetching again. A second read could
 * settle differently a second later; this cannot. It also makes the button
 * honest for free: no publication for the current range means nothing to
 * share yet.
 *
 * A store rather than context for the same reason the globe's is: the
 * publishers and the readers share no ancestor below the layout, and the
 * site switcher lives in the header tree entirely.
 *
 * Every slice carries the key of the request it came from. A slice whose
 * key is not the screen's current one is simply absent: an interval change
 * leaves the old numbers in the store for a moment, and nobody may print
 * them under the new label.
 */

export type PosterKey = string;

/** One request identity: the site, the window it was cut on, the filters. */
export function posterKey(
  slug: string,
  range: AnalyticsRange,
  filtersParam?: string
): PosterKey {
  return [slug, range.from, range.to, range.timezone, filtersParam ?? ""].join(
    "|"
  );
}

export type PosterTotals = {
  key: PosterKey;
  visitors: number;
  pageviews: number;
  /** The stat row's own reading of `meta`: only `ok` is fit to publish. */
  state: "ok" | "empty" | "stale" | "degraded";
};

export type PosterSessions = {
  key: PosterKey;
  /** `null` while the tile shows a dash: filtered view, or a failed read. */
  bounceRate: number | null;
};

export type PosterRevenue = {
  /** Keyed without filters: the revenue tile never takes one. */
  key: PosterKey;
  /** `null` when no provider is connected or the caller may not read it. */
  netMinor: number | null;
  currency: string | null;
};

export type PosterSeries = {
  key: PosterKey;
  /** Visitors per bucket, zero-filled exactly as the chart plotted them. */
  visitors: readonly number[];
};

export type PosterSite = {
  slug: string;
  name: string;
  domains: readonly string[];
};

/**
 * The four slices the other posters draw from (2026-09-06), each published
 * by the card that shows it: the sources card's referrer fold, the
 * locations card's country fold, the pages card's views ranking, and the
 * realtime card's snapshot. The lists carry the rows the poster prints and
 * the count of the whole, so "12,431 visitors from 38 sources" is the
 * card's own arithmetic.
 */
export type PosterSourceRow = {
  label: string;
  /** Canonical domain for the favicon; null for Direct and the utm cuts. */
  domain: string | null;
  direct: boolean;
  visitors: number;
};

export type PosterSources = {
  key: PosterKey;
  rows: readonly PosterSourceRow[];
  /** How many rows the fold produced, before the cut to what is printed. */
  count: number;
  /** The read was a top-N cut, so the count is a floor. */
  truncated: boolean;
};

export type PosterCountryRow = { code: string; visitors: number };

export type PosterCountries = {
  key: PosterKey;
  rows: readonly PosterCountryRow[];
  count: number;
  truncated: boolean;
};

export type PosterPageRow = { path: string; views: number };

export type PosterPages = {
  key: PosterKey;
  rows: readonly PosterPageRow[];
  count: number;
  truncated: boolean;
};

export type PosterRealtimeSlice = {
  /** Keyed by site alone: a live count has no range and takes no filter. */
  slug: string;
  count: number;
  /** The busiest paths right now, most people first. */
  pages: readonly { path: string; visitors: number }[];
  /** Where they are, most people first. */
  countries: readonly { code: string; visitors: number }[];
};

export type OverviewPosterSnapshot = {
  totals: PosterTotals | null;
  sessions: PosterSessions | null;
  revenue: PosterRevenue | null;
  series: PosterSeries | null;
  site: PosterSite | null;
  sources: PosterSources | null;
  countries: PosterCountries | null;
  pages: PosterPages | null;
  realtime: PosterRealtimeSlice | null;
};

const EMPTY: OverviewPosterSnapshot = {
  totals: null,
  sessions: null,
  revenue: null,
  series: null,
  site: null,
  sources: null,
  countries: null,
  pages: null,
  realtime: null,
};

let snapshot: OverviewPosterSnapshot = EMPTY;
const listeners = new Set<() => void>();

function commit(next: OverviewPosterSnapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

// Each publisher runs from an effect that re-fires whenever its component
// renders, so equality is checked here rather than trusted: an unchanged
// publication must not wake every subscriber.

export function publishPosterTotals(totals: PosterTotals): void {
  const current = snapshot.totals;
  if (
    current &&
    current.key === totals.key &&
    current.visitors === totals.visitors &&
    current.pageviews === totals.pageviews &&
    current.state === totals.state
  ) {
    return;
  }
  commit({ ...snapshot, totals });
}

export function publishPosterSessions(sessions: PosterSessions): void {
  const current = snapshot.sessions;
  if (
    current &&
    current.key === sessions.key &&
    current.bounceRate === sessions.bounceRate
  ) {
    return;
  }
  commit({ ...snapshot, sessions });
}

export function publishPosterRevenue(revenue: PosterRevenue): void {
  const current = snapshot.revenue;
  if (
    current &&
    current.key === revenue.key &&
    current.netMinor === revenue.netMinor &&
    current.currency === revenue.currency
  ) {
    return;
  }
  commit({ ...snapshot, revenue });
}

export function publishPosterSeries(series: PosterSeries): void {
  const current = snapshot.series;
  if (
    current &&
    current.key === series.key &&
    current.visitors.length === series.visitors.length &&
    current.visitors.every((value, index) => value === series.visitors[index])
  ) {
    return;
  }
  commit({ ...snapshot, series });
}

export function publishPosterSite(site: PosterSite): void {
  const current = snapshot.site;
  if (
    current &&
    current.slug === site.slug &&
    current.name === site.name &&
    current.domains.length === site.domains.length &&
    current.domains.every((domain, index) => domain === site.domains[index])
  ) {
    return;
  }
  commit({ ...snapshot, site });
}

// The list slices are a handful of rows each, so equality is a serialisation
// rather than a field-by-field walk; the realtime slice ticks every few
// seconds and is the one where the check earns its keep.
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

export function publishPosterSources(sources: PosterSources): void {
  if (same(snapshot.sources, sources)) return;
  commit({ ...snapshot, sources });
}

export function publishPosterCountries(countries: PosterCountries): void {
  if (same(snapshot.countries, countries)) return;
  commit({ ...snapshot, countries });
}

export function publishPosterPages(pages: PosterPages): void {
  if (same(snapshot.pages, pages)) return;
  commit({ ...snapshot, pages });
}

/** `null` withdraws it: a feed that is not live has no count to print. */
export function publishPosterRealtime(realtime: PosterRealtimeSlice | null): void {
  if (same(snapshot.realtime, realtime)) return;
  commit({ ...snapshot, realtime });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readSnapshot = () => snapshot;
const readServerSnapshot = () => EMPTY;

export function useOverviewPosterStore(): OverviewPosterSnapshot {
  return React.useSyncExternalStore(
    subscribe,
    readSnapshot,
    readServerSnapshot
  );
}
