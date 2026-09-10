"use client";

import * as React from "react";
import { useSiteAnalytics } from "@/components/dashboard/analytics-card";
import { useAnalyticsFilters } from "@/components/dashboard/filter-context";
import type { ApiResource } from "@/hooks/use-api-resource";
import { getAnalyticsSources, type AnalyticsSourcesResponse } from "@/lib/api";
import { MOCK_SOURCES } from "@/lib/mock";

/**
 * One sources read, shared by the two cards that fold it. Sources and AI
 * referrals both cut `GET /v1/sites/{site_id}/analytics/sources`, and cards
 * fetch independently with no dedupe layer in `lib/api.ts`, so two cards
 * each calling `useSiteAnalytics` would fire the same request twice on every
 * interval or filter change. The overview mounts this once around its grid;
 * a card reads through `useSourcesResource` and throws without it, which is
 * a mount error on the first render rather than a silent second request.
 */
const SourcesContext =
  React.createContext<ApiResource<AnalyticsSourcesResponse> | null>(null);

export function SourcesProvider({ children }: { children: React.ReactNode }) {
  const { filtersParam } = useAnalyticsFilters();
  const resource = useSiteAnalytics(getAnalyticsSources, MOCK_SOURCES, {
    filters: filtersParam,
  });
  return (
    <SourcesContext.Provider value={resource}>{children}</SourcesContext.Provider>
  );
}

export function useSourcesResource(): ApiResource<AnalyticsSourcesResponse> {
  const resource = React.useContext(SourcesContext);
  if (resource === null) {
    throw new Error("useSourcesResource needs a <SourcesProvider> above the card");
  }
  return resource;
}
