"use client";

import {
  ArrowLeft01Icon,
  BlueskyIcon,
  Cancel01Icon,
  Download04Icon,
  Linkedin02Icon,
  Moon02Icon,
  NewTwitterIcon,
  Share01Icon,
  Sun03Icon,
} from "hugeicons-react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";
import { useAnalyticsFilters } from "@/components/dashboard/filter-context";
import { FLOW_SPRING } from "@/components/dashboard/flow-dialog";
import { useAnalyticsInterval } from "@/components/dashboard/interval-context";
import {
  posterKey,
  useOverviewPosterStore,
} from "@/components/dashboard/overview-poster-store";
import { useIntervalLabel } from "@/components/dashboard/see-all-modal";
import { faviconUrl } from "@/components/dashboard/site-favicon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SquircleSurface } from "@/components/ui/squircle-card";
import { Switch } from "@/components/ui/switch";
import {
  DIMENSION_LABEL,
  filterValueLabel,
  type FilterClause,
} from "@/lib/analytics-filters";
import { formatMoney } from "@/lib/currencies";
import { loadImage, loadSiteFavicon } from "@/lib/poster/favicon";
import { ensurePosterFonts, posterFontFamily } from "@/lib/poster/fonts";
import {
  drawPoster,
  POSTER_COLORS,
  POSTER_HEIGHT,
  POSTER_KIND_LABEL,
  POSTER_KINDS,
  POSTER_METRICS,
  POSTER_SCALE,
  POSTER_WIDTH,
  posterFileName,
  posterSwatch,
  type PosterColor,
  type PosterKind,
  type PosterList,
  type PosterLook,
  type PosterMetric,
  type PosterMetricKey,
  type PosterModel,
  type PosterTheme,
} from "@/lib/poster/overview-poster";
import { posterMomentLabel, posterPeriodDates } from "@/lib/poster/period";
import { resolveReferrer } from "@/lib/referrers";
import { X_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Share as image: a card's numbers as a 1200×630 poster, drawn in the
 * browser and handed over as a PNG (feature_candidates §6).
 *
 * Five posters since 2026-09-06, picked at the top of the preview: the
 * overview, the top sources, the top countries, the people on the site
 * right now, and the top pages. Everything on the canvas comes from the
 * poster store, which the stat row, the chart, the list cards and the
 * realtime card fill as they render. Nothing is fetched here, so the
 * picture can never disagree with the screen, and the preview *is* the
 * file: one canvas, drawn once per change, read back by `toBlob` for the
 * download and the clipboard alike. A poster whose card has not published
 * for this screen is offered greyed, with the reason on hover.
 *
 * The choices (poster, look, figures, colour, which halves of the site's
 * brand are shown) are the customer's and remembered per browser, the way
 * the interval is. What is not a choice: an active filter is always
 * printed, because filtered rows under an unqualified headline would
 * present a slice as the whole site.
 */

const PREFS_KEY = "oa:overview-poster:v1";

type PosterPreferences = {
  kind: PosterKind;
  theme: PosterTheme;
  color: PosterColor;
  chart: boolean;
  /** The site's brand in two halves, since some want the name without the
   * mark and some the mark without the name (Abbas, 2026-09-06). */
  showName: boolean;
  showIcon: boolean;
  metrics: readonly PosterMetricKey[];
  /** The lists' rows: the figure per row, the summary line, the rank
   * tiles on the pages poster (Abbas, 2026-09-06). */
  showValues: boolean;
  showSummary: boolean;
  showRanks: boolean;
  /** The realtime poster's lists beside the count. */
  showLivePages: boolean;
  showLiveCountries: boolean;
};

const DEFAULT_PREFS: PosterPreferences = {
  kind: "overview",
  theme: "light",
  color: "blue",
  chart: true,
  showName: true,
  showIcon: true,
  metrics: POSTER_METRICS,
  showValues: true,
  showSummary: true,
  showRanks: true,
  showLivePages: true,
  showLiveCountries: true,
};

const isPosterColor = (value: unknown): value is PosterColor =>
  typeof value === "string" && POSTER_COLORS.includes(value as PosterColor);
const isPosterKind = (value: unknown): value is PosterKind =>
  typeof value === "string" && POSTER_KINDS.includes(value as PosterKind);

/** Storage never throws here: a locked-down browser gets the defaults. */
function readPreferences(): PosterPreferences {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_PREFS;
    const record = parsed as Record<string, unknown>;
    const metrics = record.metrics;
    // `hideSite` was the one switch before the two halves; a saved
    // `hideSite: true` reads as both off, which is what it meant.
    const hidden = record.hideSite === true;
    return {
      kind: isPosterKind(record.kind) ? record.kind : "overview",
      theme: record.theme === "dark" ? "dark" : "light",
      color: isPosterColor(record.color) ? record.color : "blue",
      chart: record.chart !== false,
      showName: !hidden && record.showName !== false,
      showIcon: !hidden && record.showIcon !== false,
      metrics: Array.isArray(metrics)
        ? POSTER_METRICS.filter((key) => metrics.includes(key))
        : POSTER_METRICS,
      showValues: record.showValues !== false,
      showSummary: record.showSummary !== false,
      showRanks: record.showRanks !== false,
      showLivePages: record.showLivePages !== false,
      showLiveCountries: record.showLiveCountries !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePreferences(prefs: PosterPreferences): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // The choice still applies to this modal; it is simply not remembered.
  }
}

const subscribeNever = () => () => {};

function usePosterPreferences(): [
  PosterPreferences,
  (patch: Partial<PosterPreferences>) => void,
] {
  // Read once and cached, the interval's own storage pattern: the snapshot
  // must stay identical across renders, and this modal's writes would
  // otherwise move it mid-life.
  const storedRef = React.useRef<PosterPreferences | null>(null);
  const stored = React.useSyncExternalStore(
    subscribeNever,
    () => {
      if (storedRef.current === null) storedRef.current = readPreferences();
      return storedRef.current;
    },
    () => DEFAULT_PREFS
  );
  const [edited, setEdited] = React.useState<PosterPreferences | null>(null);
  const update = React.useCallback(
    (patch: Partial<PosterPreferences>) => {
      setEdited((current) => {
        const next = { ...(current ?? stored), ...patch };
        writePreferences(next);
        return next;
      });
    },
    [stored]
  );
  return [edited ?? stored, update];
}

/** "Source: Google, GitHub · Country: Germany", the chip row's own words. */
function filtersLineOf(clauses: readonly FilterClause[]): string | null {
  if (clauses.length === 0) return null;
  return clauses
    .map((clause) => {
      const labels = new Set(
        clause.values.map((value) =>
          clause.dimension === "referrer_domain" && value !== ""
            ? resolveReferrer(value).name
            : filterValueLabel(clause.dimension, value)
        )
      );
      return `${DIMENSION_LABEL[clause.dimension]}: ${[...labels].join(", ")}`;
    })
    .join(" · ");
}

const METRIC_LABEL: Record<PosterMetricKey, string> = {
  visitors: "Visitors",
  pageviews: "Pageviews",
  bounce: "Bounce rate",
  revenue: "Revenue",
};

const SUBTITLE: Record<PosterKind, string> = {
  overview: "The numbers on screen, exactly as they read now.",
  sources: "The top sources, exactly as the card reads now.",
  countries: "The top countries, exactly as the card reads now.",
  realtime: "Who is on the site right now, as the feed has it.",
  pages: "The top pages, exactly as the card reads now.",
};

/** Region names, resolved lazily; a runtime without them prints the code. */
let regionNames: Intl.DisplayNames | null | undefined;
function regionName(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "Unknown";
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  if (regionNames === null) return code.toUpperCase();
  try {
    return regionNames.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

type ImageSource = { key: string; url: string };

/**
 * Every row mark this browser has settled, by URL, for the life of the
 * page. Switching between two list posters asks for the same handful of
 * favicons and flags again, and asking the network again, even from its
 * cache, is asynchronous: the answer arrives a frame later, and for that
 * frame the poster was not ready and blinked (Abbas, 2026-09-06). A mark
 * settled once is ready at once ever after.
 */
const settledImages = new Map<string, HTMLImageElement | null>();
const NO_IMAGES: ReadonlyMap<string, HTMLImageElement | null> = new Map();

/**
 * The rows' marks (favicons, flags) as drawables, loaded together and
 * handed back only once every one of them has settled for *this* list:
 * a poster with three of five marks is a poster mid-load, not a poster.
 * `sources` must be memoised by the caller; its identity is the request.
 */
function useImages(sources: readonly ImageSource[]): {
  ready: boolean;
  images: ReadonlyMap<string, HTMLImageElement | null>;
} {
  const cached = React.useMemo(
    () =>
      sources.every((source) => settledImages.has(source.url))
        ? new Map(
            sources.map(
              (source) =>
                [source.key, settledImages.get(source.url) ?? null] as const
            )
          )
        : null,
    [sources]
  );
  const [state, setState] = React.useState<{
    sources: readonly ImageSource[];
    images: ReadonlyMap<string, HTMLImageElement | null>;
  } | null>(null);
  React.useEffect(() => {
    // Nothing to load, or everything already settled: ready below, with no
    // state written and no request made.
    if (sources.length === 0) return;
    if (sources.every((source) => settledImages.has(source.url))) return;
    const controller = new AbortController();
    Promise.all(
      sources.map((source) =>
        loadImage(source.url, controller.signal).then((image) => {
          // An aborted load answers null at once; that is not an answer.
          if (!controller.signal.aborted) settledImages.set(source.url, image);
          return [source.key, image] as const;
        })
      )
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setState({ sources, images: new Map(entries) });
    });
    return () => controller.abort();
  }, [sources]);
  if (sources.length === 0) return { ready: true, images: NO_IMAGES };
  if (cached) return { ready: true, images: cached };
  const loaded = state !== null && state.sources === sources;
  return { ready: loaded, images: loaded ? state.images : NO_IMAGES };
}

const EMPTY_SOURCES: readonly ImageSource[] = [];

/** A phone or a tablet, as far as a browser will say. */
const onMobile = (): boolean =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/**
 * Where a poster can be posted. A web intent takes text and no file, so the
 * image travels on the clipboard: Share copies it, then the button turns
 * into these three and the person pastes into whichever composer opens
 * (Abbas, 2026-09-06). LinkedIn has no text intent of its own; its feed
 * opened with `shareActive` prefills the composer the same way.
 */
type Network = "x" | "bluesky" | "linkedin";
const NETWORKS: {
  id: Network;
  label: string;
  Icon: typeof NewTwitterIcon;
  /** The web composer. */
  compose: (text: string) => string;
  /** The app's own composer, by URL scheme, for a phone without a share
   * sheet: a web intent tapped there opens the app and then the intent
   * *page* inside its browser, not the composer (Abbas, 2026-09-06).
   * LinkedIn has no scheme that takes text. */
  app?: (text: string) => string;
}[] = [
  {
    id: "x",
    label: "Post on X",
    Icon: NewTwitterIcon,
    compose: (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
    app: (text) => `twitter://post?message=${encodeURIComponent(text)}`,
  },
  {
    id: "bluesky",
    label: "Post on Bluesky",
    Icon: BlueskyIcon,
    compose: (text) =>
      `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
    app: (text) => `bluesky://intent/compose?text=${encodeURIComponent(text)}`,
  },
  {
    id: "linkedin",
    label: "Post on LinkedIn",
    Icon: Linkedin02Icon,
    compose: (text) =>
      `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
  },
];

const PILL_SPRING = { type: "spring", stiffness: 550, damping: 42 } as const;

/**
 * A box whose height follows its content in a tween rather than a jump.
 * The content itself changes at once; the measurement comes from a
 * `ResizeObserver`, which also delivers the first size, so nothing is
 * written from an effect body. That first size applies instantly: it lands
 * a frame after the modal is on screen at `height: auto`, and tweening
 * from that to the measured pixels showed as the block below shifting a
 * beat after opening (`FlowDialog` learned the same, and Abbas saw it
 * here, 2026-09-06). Only later changes animate.
 */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [settled, setSettled] = React.useState(false);
  React.useEffect(() => {
    if (height === null || settled) return;
    const raise = setTimeout(() => setSettled(true), 0);
    return () => clearTimeout(raise);
  }, [height, settled]);
  return (
    <motion.div
      animate={{ height: height ?? "auto" }}
      className="overflow-hidden"
      initial={false}
      transition={
        settled ? { duration: 0.24, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }
      }
    >
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

/**
 * A segmented control whose active pill slides between the segments, the
 * dashboard's own manner for a choice among a few (Abbas, 2026-09-06). A
 * segment with a reason stays in the row, greyed, and says why on hover.
 */
function Segmented<T extends string>({
  columns,
  label,
  segments,
  value,
  onChange,
}: {
  columns: number;
  label: string;
  segments: readonly {
    value: T;
    label: React.ReactNode;
    reason?: string | null;
  }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const id = React.useId();
  return (
    <div
      aria-label={label}
      className="grid gap-1 rounded-full bg-black/4 p-1"
      role="group"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        const reason = segment.reason ?? null;
        return (
          <button
            aria-disabled={reason !== null}
            aria-pressed={active}
            className={cn(
              "relative flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "text-foreground"
                : reason !== null
                  ? "cursor-not-allowed text-muted-foreground/45"
                  : "cursor-pointer text-muted-foreground hover:text-foreground"
            )}
            key={segment.value}
            onClick={() => {
              if (reason === null) onChange(segment.value);
            }}
            title={reason ?? undefined}
            type="button"
          >
            {active ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-card shadow-xs"
                layoutId={`${id}-pill`}
                transition={PILL_SPRING}
              />
            ) : null}
            <span className="relative z-10 flex items-center gap-1.5">
              {segment.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function OverviewPosterModal({ onClose }: { onClose: () => void }) {
  const params = useParams<{ site: string }>();
  const slug = params.site ? decodeURIComponent(params.site) : "";
  const { range } = useAnalyticsInterval();
  const periodLabel = useIntervalLabel();
  const {
    clauses,
    active: filtersActive,
    filtersParam,
  } = useAnalyticsFilters();
  const store = useOverviewPosterStore();
  const [prefs, update] = usePosterPreferences();

  // Only the slices published for *this* screen count; the rest is the
  // previous range still sitting in the store.
  const key = posterKey(slug, range, filtersParam);
  const revenueKey = posterKey(slug, range);
  const totals = store.totals?.key === key ? store.totals : null;
  const sessions = store.sessions?.key === key ? store.sessions : null;
  const revenue = store.revenue?.key === revenueKey ? store.revenue : null;
  const series = store.series?.key === key ? store.series : null;
  const site = store.site?.slug === slug ? store.site : null;
  const sourcesSlice = store.sources?.key === key ? store.sources : null;
  const countriesSlice =
    store.countries?.key === key ? store.countries : null;
  const pagesSlice = store.pages?.key === key ? store.pages : null;
  const realtimeSlice =
    store.realtime?.slug === slug ? store.realtime : null;

  // Which posters can be drawn right now, and why not otherwise. The
  // overview is always one of them: the button that opens this modal
  // waits for its numbers.
  const unavailable: Record<PosterKind, string | null> = {
    overview: totals ? null : "Waiting for the numbers",
    sources: sourcesSlice ? null : "Waiting for the sources card",
    countries: countriesSlice ? null : "Waiting for the locations card",
    realtime: realtimeSlice ? null : "Waiting for the realtime feed",
    pages: pagesSlice ? null : "Waiting for the top pages card",
  };
  const kind: PosterKind =
    unavailable[prefs.kind] === null
      ? prefs.kind
      : (POSTER_KINDS.find((entry) => unavailable[entry] === null) ??
        "overview");

  // Bounce rides the sessions read, which takes no filter; the tile shows a
  // dash under one, so the poster offers nothing there either. Revenue is
  // the same population problem: an unfiltered figure beside filtered
  // counts would read as one row of facts.
  const bounceAvailable =
    !filtersActive && sessions !== null && sessions.bounceRate !== null;
  const revenueOffered = revenue !== null && revenue.netMinor !== null;
  const revenueAvailable = revenueOffered && !filtersActive;
  const chartAvailable = series !== null && series.visitors.length >= 2;

  // The page's own type, loaded before the first draw.
  const family = React.useMemo(() => posterFontFamily(), []);
  const [fontsReady, setFontsReady] = React.useState(false);
  React.useEffect(() => {
    let alive = true;
    ensurePosterFonts(family).then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, [family]);

  // The site's mark, walked exactly as the switcher walks it.
  const domains = site?.domains ?? null;
  const domainsKey = domains ? domains.join(",") : "";
  const [favicon, setFavicon] = React.useState<{
    key: string;
    image: HTMLImageElement | null;
  } | null>(null);
  React.useEffect(() => {
    if (!domains) return;
    const controller = new AbortController();
    loadSiteFavicon(domains, controller.signal).then((image) => {
      if (!controller.signal.aborted) {
        setFavicon({ key: domains.join(","), image });
      }
    });
    return () => controller.abort();
  }, [domains]);
  const faviconReady = favicon !== null && favicon.key === domainsKey;

  // The rows' marks for the poster being drawn: favicons through our own
  // route, flags from our own files, both same-origin so the canvas stays
  // untainted and `toBlob` allowed.
  const imageSources = React.useMemo<readonly ImageSource[]>(() => {
    if (kind === "sources" && sourcesSlice) {
      return sourcesSlice.rows.flatMap((row) =>
        row.domain ? [{ key: row.domain, url: faviconUrl(row.domain) }] : []
      );
    }
    const flags = (rows: readonly { code: string }[]) =>
      rows.flatMap((row) =>
        /^[A-Za-z]{2}$/.test(row.code)
          ? [{ key: row.code, url: `/flags/${row.code.toLowerCase()}.svg` }]
          : []
      );
    if (kind === "countries" && countriesSlice) return flags(countriesSlice.rows);
    if (kind === "realtime" && realtimeSlice) {
      return flags(realtimeSlice.countries.slice(0, 3));
    }
    return EMPTY_SOURCES;
  }, [kind, sourcesSlice, countriesSlice, realtimeSlice]);
  const rowImages = useImages(imageSources);

  const metrics = React.useMemo<PosterMetric[]>(() => {
    if (!totals) return [];
    const chosen = new Set(prefs.metrics);
    const list: PosterMetric[] = [];
    if (chosen.has("visitors")) {
      list.push({
        key: "visitors",
        label: METRIC_LABEL.visitors,
        value: totals.visitors.toLocaleString("en-US"),
      });
    }
    if (chosen.has("pageviews")) {
      list.push({
        key: "pageviews",
        label: METRIC_LABEL.pageviews,
        value: totals.pageviews.toLocaleString("en-US"),
      });
    }
    if (
      chosen.has("bounce") &&
      bounceAvailable &&
      sessions &&
      sessions.bounceRate !== null
    ) {
      list.push({
        key: "bounce",
        label: METRIC_LABEL.bounce,
        value: `${Math.round(sessions.bounceRate * 100)}%`,
      });
    }
    if (
      chosen.has("revenue") &&
      revenueAvailable &&
      revenue &&
      revenue.netMinor !== null &&
      revenue.currency
    ) {
      list.push({
        key: "revenue",
        label: METRIC_LABEL.revenue,
        value: formatMoney(revenue.netMinor, revenue.currency),
      });
    }
    return list;
  }, [
    totals,
    sessions,
    revenue,
    prefs.metrics,
    bounceAvailable,
    revenueAvailable,
  ]);

  // The ranked list for the list posters, with the stat row's own totals
  // as the whole: the same visitors the poster's neighbour prints, and the
  // fold's count of rows (a floor when the read was a top-N cut).
  const list = React.useMemo<PosterList | null>(() => {
    if (!totals) return null;
    const figure = (value: number) => value.toLocaleString("en-US");
    const countOf = (count: number, truncated: boolean) =>
      `${figure(count)}${truncated ? "+" : ""}`;
    if (kind === "sources" && sourcesSlice) {
      return {
        title: "Top sources",
        whole: `${figure(totals.visitors)} visitors from ${countOf(sourcesSlice.count, sourcesSlice.truncated)} ${sourcesSlice.count === 1 && !sourcesSlice.truncated ? "source" : "sources"}`,
        rows: sourcesSlice.rows.map((row) => ({
          label: row.label,
          value: row.visitors,
          image: row.domain ? (rowImages.images.get(row.domain) ?? null) : null,
          imageShape: "square" as const,
          fallback: row.direct ? ("direct" as const) : ("rank" as const),
        })),
      };
    }
    if (kind === "countries" && countriesSlice) {
      return {
        title: "Top countries",
        whole: `${figure(totals.visitors)} visitors from ${countOf(countriesSlice.count, countriesSlice.truncated)} ${countriesSlice.count === 1 && !countriesSlice.truncated ? "country" : "countries"}`,
        rows: countriesSlice.rows.map((row) => ({
          label: regionName(row.code),
          value: row.visitors,
          image: rowImages.images.get(row.code) ?? null,
          imageShape: "round" as const,
          fallback: "rank" as const,
        })),
      };
    }
    if (kind === "pages" && pagesSlice) {
      return {
        title: "Top pages",
        whole: `${figure(totals.pageviews)} pageviews across ${countOf(pagesSlice.count, pagesSlice.truncated)} ${pagesSlice.count === 1 && !pagesSlice.truncated ? "page" : "pages"}`,
        rows: pagesSlice.rows.map((row) => ({
          label: row.path,
          mono: true,
          value: row.views,
          image: null,
          imageShape: "square" as const,
          fallback: "rank" as const,
        })),
      };
    }
    return null;
  }, [kind, totals, sourcesSlice, countriesSlice, pagesSlice, rowImages.images]);

  const filtersLine = React.useMemo(() => filtersLineOf(clauses), [clauses]);
  const dates = React.useMemo(() => posterPeriodDates(range), [range]);
  const faviconImage = faviconReady ? favicon.image : null;
  const seriesValues = series?.visitors ?? null;

  const model = React.useMemo<PosterModel | null>(() => {
    if (!site) return null;
    const brand = { name: site.name, favicon: faviconImage };
    if (kind === "overview") {
      if (!totals) return null;
      return {
        kind,
        site: brand,
        period: { label: periodLabel, dates },
        metrics,
        series: seriesValues ?? [],
        filters: filtersLine,
        list: null,
        realtime: null,
      };
    }
    if (kind === "realtime") {
      if (!realtimeSlice) return null;
      return {
        kind,
        site: brand,
        // A live count has no range: the moment it was made is its date.
        period: {
          label: "Right now",
          dates: posterMomentLabel(new Date(), range.timezone),
        },
        metrics: [],
        series: [],
        // Unfiltered by construction: the feed takes no filter.
        filters: null,
        list: null,
        realtime: {
          count: realtimeSlice.count,
          pages: realtimeSlice.pages.map((page) => ({
            path: page.path,
            people: page.visitors,
          })),
          countries: realtimeSlice.countries.slice(0, 3).map((entry) => ({
            name: regionName(entry.code),
            image: rowImages.images.get(entry.code) ?? null,
            people: entry.visitors,
          })),
        },
      };
    }
    if (!list) return null;
    return {
      kind,
      site: brand,
      period: { label: periodLabel, dates },
      metrics: [],
      series: [],
      filters: filtersLine,
      list,
      realtime: null,
    };
  }, [
    kind,
    site,
    totals,
    faviconImage,
    periodLabel,
    dates,
    metrics,
    seriesValues,
    filtersLine,
    list,
    realtimeSlice,
    rowImages.images,
    range.timezone,
  ]);

  const look = React.useMemo<PosterLook>(
    () => ({
      theme: prefs.theme,
      color: prefs.color,
      chart: prefs.chart && chartAvailable,
      showName: prefs.showName,
      showIcon: prefs.showIcon,
      values: prefs.showValues,
      summary: prefs.showSummary,
      ranks: prefs.showRanks,
      livePages: prefs.showLivePages,
      liveCountries: prefs.showLiveCountries,
    }),
    [
      prefs.theme,
      prefs.color,
      prefs.chart,
      prefs.showName,
      prefs.showIcon,
      prefs.showValues,
      prefs.showSummary,
      prefs.showRanks,
      prefs.showLivePages,
      prefs.showLiveCountries,
      chartAvailable,
    ]
  );

  // Which block of options folds in under Look: the overview's figures,
  // a list's rows, the realtime poster's lists. Keyed by the block rather
  // than the poster, so switching between two list posters swaps nothing.
  const optionsBlock =
    kind === "overview" ? "numbers" : kind === "realtime" ? "live" : "rows";

  const ready =
    model !== null &&
    fontsReady &&
    (!prefs.showIcon || faviconReady) &&
    (imageSources.length === 0 || rowImages.ready);

  // Once a poster has been drawn, the canvas stays: a switch that has to
  // load something shows the last picture for the moment it takes rather
  // than a pulse. Only the first draw is waited for behind the placeholder.
  // Adjusted during render on purpose, the derived-state pattern, so no
  // effect has to write state.
  const [everReady, setEverReady] = React.useState(false);
  if (ready && !everReady) setEverReady(true);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    if (!ready || !model) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawPoster(ctx, model, look, family);
  }, [ready, model, look, family]);

  const [note, setNote] = React.useState<string | null>(null);
  // Shared for *this* drawing: the poster or its look changing puts the
  // Share button back, since the clipboard holds the picture before.
  const drawKey = JSON.stringify({ kind, look });
  const [sharedFor, setSharedFor] = React.useState<string | null>(null);
  const shared = sharedFor === drawKey;
  /** Whether the last Share got the image onto the clipboard. */
  const [carried, setCarried] = React.useState(true);
  const sharedNote = carried
    ? "Image copied. Just paste it into your post."
    : "Copying is blocked here. Download the image and attach it.";

  const fileName = posterFileName(
    site?.name ?? slug,
    kind,
    kind === "realtime" ? "right now" : periodLabel
  );

  const toBlob = React.useCallback(
    () =>
      new Promise<Blob>((resolve, reject) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          reject(new Error("The poster has not been drawn"));
          return;
        }
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Empty PNG")),
          "image/png"
        );
      }),
    []
  );

  const download = async () => {
    try {
      const blob = await toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(null);
    } catch {
      setNote("The image could not be rendered. Try again.");
    }
  };

  // Feature-detected rather than assumed: Firefox has no `ClipboardItem`
  // for images in every version, and a button that fails on press is
  // worse than a button that is not there.
  const canCopy = React.useSyncExternalStore(
    subscribeNever,
    () =>
      typeof ClipboardItem !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.clipboard?.write === "function",
    () => false
  );

  /**
   * Share: the image onto the clipboard, inside the press (Safari honours a
   * clipboard write only when it starts within the user gesture), then the
   * networks take the button's place. A blocked clipboard still opens the
   * networks; the note beside them says to attach the image by hand.
   */
  const share = async () => {
    // A phone with a share sheet gets the sheet, with the image in it: the
    // sheet hands the file to whichever app is picked, so no clipboard, no
    // paste, and no intent page opening inside an app's browser. Only where
    // files can be shared, and only on a phone: a desktop Safari has a sheet
    // too, but the composers with our own text are the better door there.
    if (onMobile() && typeof navigator.canShare === "function") {
      try {
        const blob = await toBlob();
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: postText("sheet") });
          return;
        }
      } catch (raised: unknown) {
        // Cancelling the sheet is not a failure, and nothing else here
        // needs saying either: the networks below are the fallback.
        if (raised instanceof DOMException && raised.name === "AbortError") return;
      }
    }
    let onClipboard = false;
    if (canCopy) {
      try {
        const item = new ClipboardItem({ "image/png": toBlob() });
        await navigator.clipboard.write([item]);
        onClipboard = true;
      } catch {
        // Said beside the networks, not as an alert.
      }
    }
    setCarried(onClipboard);
    setNote(null);
    setSharedFor(drawKey);
  };

  /** The post's text: the poster's own sentence, then who measured it. */
  const postText = (network: Network | "sheet"): string => {
    const name = site?.name ?? slug;
    const when = kind === "realtime" ? "right now" : periodLabel.toLowerCase();
    const figure = (value: number) => value.toLocaleString("en-US");
    const top = (rows: readonly { label: string }[]) =>
      rows
        .slice(0, 3)
        .map((row) => row.label)
        .join(", ");
    let line: string;
    switch (kind) {
      case "overview":
        line = totals
          ? `${name}, ${when}: ${figure(totals.visitors)} visitors and ${figure(totals.pageviews)} pageviews.`
          : `${name}, ${when}.`;
        break;
      case "sources":
        line = `Where ${name}'s visitors came from, ${when}: ${top(list?.rows ?? [])}.`;
        break;
      case "countries":
        line = `Where ${name}'s visitors were, ${when}: ${top(list?.rows ?? [])}.`;
        break;
      case "pages":
        line = `${name}'s most read pages, ${when}: ${top(list?.rows ?? [])}.`;
        break;
      case "realtime":
        line = `${figure(realtimeSlice?.count ?? 0)} people on ${name} right now.`;
        break;
    }
    // Our handle where it is one, the name and the domain elsewhere.
    const handle = X_URL.replace(/^https?:\/\/(www\.)?x\.com\//, "");
    const credit =
      network === "x"
        ? `Measured with @${handle}`
        : "Measured with Open Analytics, getopen.so";
    return `${line}\n\n${credit}`;
  };

  /**
   * Opens a network's composer. On a phone the app's own, by scheme, with
   * the web composer a beat later if the page is still in front (no app,
   * then); elsewhere the web composer in a new tab.
   */
  const openNetwork = (network: (typeof NETWORKS)[number]) => {
    const text = postText(network.id);
    const web = network.compose(text);
    if (onMobile() && network.app) {
      window.setTimeout(() => {
        if (document.visibilityState === "visible") window.location.assign(web);
      }, 1200);
      window.location.assign(network.app(text));
      return;
    }
    window.open(web, "_blank", "noopener,noreferrer");
  };

  const toggleMetric = (metric: PosterMetricKey, on: boolean) => {
    const next = POSTER_METRICS.filter((key) =>
      key === metric ? on : prefs.metrics.includes(key)
    );
    update({ metrics: next });
  };

  return (
    <PosterDialog
      footer={
        <>
          {/* Share, then the three networks in its place with the note
              beside them; the poster changing brings Share back. */}
          <AnimatePresence initial={false} mode="popLayout">
            {shared ? (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                initial={{ opacity: 0, x: 10 }}
                key="networks"
                transition={FLOW_SPRING}
              >
                {/* Beside the icons from `sm` up; on a phone the footer
                    has no room and the line sits under the preview's
                    caption instead (Abbas, 2026-09-06). */}
                <span className="text-xs text-muted-foreground max-sm:hidden">
                  {sharedNote}
                </span>
                {/* The way back to Share, at the head of the icons rather
                    than of the note. The networks and it are icon-only
                    `xs` buttons: the same height as the row's other
                    buttons, a disc rather than the `icon` size, which
                    stood a step taller (Abbas, 2026-09-06). */}
                <Button
                  aria-label="Back"
                  className="size-7 px-0 has-[>svg]:px-0"
                  onClick={() => setSharedFor(null)}
                  size="xs"
                  title="Back"
                  variant="secondary"
                >
                  <ArrowLeft01Icon aria-hidden="true" className="size-3.5" />
                </Button>
                {NETWORKS.map((network, index) => (
                  <motion.span
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex"
                    initial={{ opacity: 0, scale: 0.6 }}
                    key={network.id}
                    transition={{ ...FLOW_SPRING, delay: 0.04 * index }}
                  >
                    <Button
                      aria-label={network.label}
                      className="size-7 px-0 has-[>svg]:px-0"
                      onClick={() => openNetwork(network)}
                      size="xs"
                      title={network.label}
                      variant="secondary"
                    >
                      <network.Icon aria-hidden="true" className="size-3.5" />
                    </Button>
                  </motion.span>
                ))}
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="flex"
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
                initial={{ opacity: 0, scale: 0.9 }}
                key="share"
                transition={FLOW_SPRING}
              >
                <Button
                  disabled={!ready}
                  onClick={share}
                  size="xs"
                  variant="secondary"
                >
                  <Share01Icon aria-hidden="true" />
                  Share
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button disabled={!ready} onClick={download} size="xs">
            <Download04Icon aria-hidden="true" />
            Download PNG
          </Button>
        </>
      }
      onClose={onClose}
      subtitle={SUBTITLE[kind]}
      title="Share as image"
    >
      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Which poster, above the preview it changes (Abbas, 2026-09-06).
              A poster whose card has not published for this screen stays
              in the row, greyed, with the reason on hover: the row is the
              list of posters, not the list of posters available now. */}
          <Segmented
            columns={POSTER_KINDS.length}
            label="Poster"
            onChange={(next) => update({ kind: next })}
            segments={POSTER_KINDS.map((entry) => ({
              value: entry,
              label: POSTER_KIND_LABEL[entry],
              reason: unavailable[entry],
            }))}
            value={kind}
          />
          <div
            className="relative overflow-hidden rounded-xl border-[0.5px] border-border bg-[#f6f6f6]"
            style={{ aspectRatio: `${POSTER_WIDTH} / ${POSTER_HEIGHT}` }}
          >
            <canvas
              aria-label="Poster preview"
              className={cn("block h-full w-full", !everReady && "invisible")}
              height={POSTER_HEIGHT * POSTER_SCALE}
              ref={canvasRef}
              width={POSTER_WIDTH * POSTER_SCALE}
            />
            {!everReady ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 animate-pulse bg-muted-foreground/10"
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {filtersActive && kind !== "realtime"
              ? "The active filters are printed on the image."
              : `PNG, ${POSTER_WIDTH * POSTER_SCALE} × ${POSTER_HEIGHT * POSTER_SCALE}.`}
          </p>
          {shared ? (
            <p className="text-xs text-muted-foreground sm:hidden" role="status">
              {sharedNote}
            </p>
          ) : null}
          {note ? (
            <p className="text-xs text-destructive" role="alert">
              {note}
            </p>
          ) : null}
        </div>

        {/* Spacing carried by each block rather than a column gap, so the
            Numbers block can fold to nothing, spacing included, without a
            gap left standing where it was. */}
        <div className="flex flex-col">
          <div className="pb-5">
            <Section label="Look">
              <Segmented
                columns={2}
                label="Look"
                onChange={(next) => update({ theme: next })}
                segments={(["light", "dark"] as const).map((theme) => ({
                  value: theme,
                  label: (
                    <>
                      {theme === "light" ? (
                        <Sun03Icon aria-hidden="true" className="size-3.5" />
                      ) : (
                        <Moon02Icon aria-hidden="true" className="size-3.5" />
                      )}
                      {theme === "light" ? "Light" : "Dark"}
                    </>
                  ),
                }))}
                value={prefs.theme}
              />
            </Section>
          </div>

          {/* A poster's own options swap at once when another is picked;
              only the height moves, so the card changes size in one motion
              rather than in a jump. The fold that faded the old block out
              and the new one in went the same day (Abbas, 2026-09-06): the
              card's motion was enough, and the menu's own was one too many. */}
          <AutoHeight>
            {optionsBlock === "live" ? (
                <div className="pb-5">
                  <Section label="Beside the count">
                    <div className="flex flex-col gap-2">
                      <MetricRow
                        checked={prefs.showLivePages}
                        label="Pages"
                        onChange={(on) => update({ showLivePages: on })}
                      />
                      <MetricRow
                        checked={prefs.showLiveCountries}
                        label="Countries"
                        onChange={(on) => update({ showLiveCountries: on })}
                      />
                    </div>
                  </Section>
                </div>
            ) : null}
            {optionsBlock === "rows" ? (
                <div className="pb-5">
                  <Section label="Rows">
                    <div className="flex flex-col gap-2">
                      <MetricRow
                        checked={prefs.showValues}
                        label="Numbers"
                        onChange={(on) => update({ showValues: on })}
                      />
                      <MetricRow
                        checked={prefs.showSummary}
                        label="Summary line"
                        onChange={(on) => update({ showSummary: on })}
                      />
                      {kind === "pages" ? (
                        <MetricRow
                          checked={prefs.showRanks}
                          label="Rank numbers"
                          onChange={(on) => update({ showRanks: on })}
                        />
                      ) : null}
                    </div>
                  </Section>
                </div>
            ) : null}
            {optionsBlock === "numbers" ? (
                <div className="pb-5">
            <Section label="Numbers">
              <div className="flex flex-col gap-2">
                <MetricRow
                  checked={prefs.metrics.includes("visitors")}
                  label={METRIC_LABEL.visitors}
                  onChange={(on) => toggleMetric("visitors", on)}
                />
                <MetricRow
                  checked={prefs.metrics.includes("pageviews")}
                  label={METRIC_LABEL.pageviews}
                  onChange={(on) => toggleMetric("pageviews", on)}
                />
                <MetricRow
                  checked={prefs.metrics.includes("bounce") && bounceAvailable}
                  disabled={!bounceAvailable}
                  hint={
                    filtersActive
                      ? "Paused while filters are on"
                      : bounceAvailable
                        ? undefined
                        : "Not available"
                  }
                  label={METRIC_LABEL.bounce}
                  onChange={(on) => toggleMetric("bounce", on)}
                />
                {revenueOffered ? (
                  <MetricRow
                    checked={
                      prefs.metrics.includes("revenue") && revenueAvailable
                    }
                    disabled={!revenueAvailable}
                    hint={
                      filtersActive ? "Paused while filters are on" : undefined
                    }
                    label={METRIC_LABEL.revenue}
                    onChange={(on) => toggleMetric("revenue", on)}
                  />
                ) : null}
                <MetricRow
                  checked={prefs.chart && chartAvailable}
                  disabled={!chartAvailable}
                  hint={chartAvailable ? undefined : "No chart for this range"}
                  label="Chart"
                  onChange={(on) => update({ chart: on })}
                />
              </div>
            </Section>
                </div>
            ) : null}
          </AutoHeight>

          <div className="pb-5">
          <Section label="Color">
            <div className="flex flex-wrap gap-2">
              {POSTER_COLORS.map((color) => {
                // The hue over the light it glows into, the way the chart
                // paints them: a flat disc promised a flat fill.
                const swatch = posterSwatch(color);
                return (
                  <button
                    aria-label={color[0].toUpperCase() + color.slice(1)}
                    aria-pressed={prefs.color === color}
                    className={cn(
                      "size-7 cursor-pointer rounded-full border-2 outline-none transition-[border-color,transform] hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2",
                      prefs.color === color
                        ? "border-foreground"
                        : "border-transparent"
                    )}
                    key={color}
                    onClick={() => update({ color })}
                    style={{
                      background: `linear-gradient(to bottom, ${swatch.hue}, ${swatch.glow})`,
                      boxShadow: "inset 0 0 0 2px var(--card)",
                    }}
                    type="button"
                  />
                );
              })}
            </div>
          </Section>
          </div>

          <Section label="Site">
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block">Show the site name</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {site?.name ?? slug}
                  </span>
                </span>
                <Switch
                  checked={prefs.showName}
                  onCheckedChange={(checked: boolean) =>
                    update({ showName: checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block">Show the site icon</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {faviconReady && favicon.image
                      ? "The favicon"
                      : "The initial, until a favicon is found"}
                  </span>
                </span>
                <Switch
                  checked={prefs.showIcon}
                  onCheckedChange={(checked: boolean) =>
                    update({ showIcon: checked })
                  }
                />
              </label>
            </div>
          </Section>
        </div>
      </div>
    </PosterDialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function MetricRow({
  label,
  checked,
  disabled = false,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2.5 text-sm",
        disabled ? "text-muted-foreground" : "cursor-pointer"
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next: boolean) => onChange(next)}
      />
      <span className="flex-1">{label}</span>
      {hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * The flow dialogs' shell, one size up: the same squircle frame on grey,
 * header strip, inset white panel and footer strip, wide enough for a
 * 16:9 preview beside its options. Portaled for the same reason those are.
 */
function PosterDialog({
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        initial={{ opacity: 0 }}
        key="poster-backdrop"
        onClick={onClose}
      />
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-label={title}
        aria-modal="true"
        className="relative w-full max-w-4xl"
        exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } }}
        initial={{ opacity: 0, scale: 0.94, y: -6 }}
        key="poster-card"
        role="dialog"
        transition={FLOW_SPRING}
      >
        {/* the shadow lives on this unclipped wrapper; a clip-path cannot
            clip a box shadow */}
        <div className="rounded-[26px] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_24px_60px_rgba(0,0,0,0.18)] sm:rounded-[50px]">
          <SquircleSurface className="flex max-h-[calc(100svh-2rem)] flex-col rounded-[26px] border border-border bg-[#f6f6f6] p-1 [--card-clip-handle:2.25px] [--card-clip-radius:14px] sm:rounded-[50px] sm:[--card-clip-handle:3px] sm:[--card-clip-radius:20px]">
            <div className="flex h-9 shrink-0 items-center justify-between pl-3.5 pr-1">
              <span className="text-sm font-medium text-foreground/80">
                {title}
              </span>
              <button
                aria-label="Close"
                className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-black/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={onClose}
                type="button"
              >
                <Cancel01Icon className="size-4" />
              </button>
            </div>

            <SquircleSurface className="min-h-0 overflow-y-auto rounded-[22px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.06)] [--card-clip-radius:12px] sm:rounded-[44px] sm:[--card-clip-radius:17px]">
              {children}
            </SquircleSurface>

            <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 pb-1 pl-3.5 pr-1 pt-1">
              <p className="text-xs text-muted-foreground">{subtitle}</p>
              <div className="flex items-center gap-2">{footer}</div>
            </div>
          </SquircleSurface>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
