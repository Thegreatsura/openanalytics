"use client";

import { useParams } from "next/navigation";
import * as React from "react";
import { useAnalyticsFilters } from "@/components/dashboard/filter-context";
import { useAnalyticsInterval } from "@/components/dashboard/interval-context";
import {
  posterKey,
  publishPosterCountries,
  publishPosterPages,
  publishPosterSources,
  type PosterCountryRow,
  type PosterPageRow,
  type PosterSourceRow,
} from "@/components/dashboard/overview-poster-store";

/**
 * How the list cards hand their rows to the share posters: one hook each,
 * called from the card with the rows it is showing, or `null` while it is
 * not showing them (loading, an error, a cut the poster does not print).
 *
 * Hooks rather than publisher components so a card adds one line and no
 * JSX; the key is computed here from the same interval and filter contexts
 * the card's own read used, so a slice can only ever be filed under the
 * request it came from. The rows are cut to the five the poster prints;
 * the count keeps the whole.
 */

/** The five the poster prints. */
const PRINTED = 5;

function useKey(): string {
  const params = useParams<{ site: string }>();
  const slug = params.site ? decodeURIComponent(params.site) : "";
  const { range } = useAnalyticsInterval();
  const { filtersParam } = useAnalyticsFilters();
  return posterKey(slug, range, filtersParam);
}

export function usePublishPosterSources(
  rows: readonly PosterSourceRow[] | null,
  truncated: boolean
): void {
  const key = useKey();
  React.useEffect(() => {
    if (rows === null) return;
    publishPosterSources({
      key,
      rows: rows.slice(0, PRINTED),
      count: rows.length,
      truncated,
    });
  }, [key, rows, truncated]);
}

export function usePublishPosterCountries(
  rows: readonly PosterCountryRow[] | null,
  truncated: boolean
): void {
  const key = useKey();
  React.useEffect(() => {
    if (rows === null) return;
    publishPosterCountries({
      key,
      rows: rows.slice(0, PRINTED),
      count: rows.length,
      truncated,
    });
  }, [key, rows, truncated]);
}

export function usePublishPosterPages(
  rows: readonly PosterPageRow[] | null,
  truncated: boolean
): void {
  const key = useKey();
  React.useEffect(() => {
    if (rows === null) return;
    publishPosterPages({
      key,
      rows: rows.slice(0, PRINTED),
      count: rows.length,
      truncated,
    });
  }, [key, rows, truncated]);
}
