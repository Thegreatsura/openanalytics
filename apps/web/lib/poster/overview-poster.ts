import { paintColumn } from "@/components/dither-kit/dither-paint";
import {
  PALETTE,
  type DitherColor,
  type Rgb,
} from "@/components/dither-kit/palette";
import {
  BAND_HEIGHT,
  BAND_TOPS,
  BASE_TOP,
  RING_PATH,
} from "@/components/ui/logo";

/**
 * The share posters: a 1200×630 picture of what a card has on screen, drawn
 * on a canvas in the customer's own browser (feature_candidates §6).
 *
 * Five posters since 2026-09-06 (Abbas, from the poster lab at
 * `/playground/posters`): the overview's figures and chart, the top
 * sources, the top countries, the people on the site right now, and the
 * top pages. The lab's question was how the site's brand and ours share
 * one picture without competing on one line, and the answer is the same
 * on every poster: the site's mark and name are the headline, the period
 * stands in the top-right corner, and we are a small tab grown out of the
 * bottom edge, centred, mark and name. Two arrangements of the site's
 * half: the **headline** (overview, sources, countries), across the top;
 * and the **rail** (realtime, pages), a column on the left with the
 * period under the name and the numbers to the right of a hairline.
 *
 * Not a screenshot, on purpose. The dashboard is exactly the kind of page
 * DOM-to-image libraries fail on (squircle clip paths, backdrop blur, a
 * palette in `oklch()` and `color-mix()`), and a card cropped out of a
 * dashboard is a poor social image anyway. So this draws a purpose-built
 * composition from the numbers the cards already hold, at one fixed size,
 * in the product's own type and mark.
 *
 * Pure: no React, no fetch, no DOM beyond the context it is handed and the
 * scratch canvas it makes beside that context's own for the chart. The
 * modal assembles a `PosterModel` from what the cards have published and
 * asks this to draw it; the preview and the downloaded file come off the
 * same canvas, which is what makes "the modal shows exactly what you get"
 * a structural fact rather than a promise.
 */

export const POSTER_WIDTH = 1200;
export const POSTER_HEIGHT = 630;
/**
 * Fixed backing scale, never the screen's own `devicePixelRatio`: the file
 * is 2400×1260 whether it was made on a phone or a retina desktop, so two
 * people sharing the same range produce the same bytes.
 */
export const POSTER_SCALE = 2;

export const POSTER_KINDS = [
  "overview",
  "sources",
  "countries",
  "realtime",
  "pages",
] as const;
export type PosterKind = (typeof POSTER_KINDS)[number];

export const POSTER_KIND_LABEL: Record<PosterKind, string> = {
  overview: "Overview",
  sources: "Sources",
  countries: "Countries",
  realtime: "Realtime",
  pages: "Top pages",
};

/** The dither palette's six series colours; grey is the no-data tone. */
export const POSTER_COLORS = [
  "blue",
  "green",
  "purple",
  "pink",
  "orange",
  "red",
] as const satisfies readonly DitherColor[];
export type PosterColor = (typeof POSTER_COLORS)[number];

/**
 * The dashboard sparklines' "low" bloom (`bloomLayerStyle` in the kit),
 * restated because the poster composites it on a canvas rather than through
 * CSS. `blur` is in cells, the kit's 3px at its 2px cell.
 */
const BLOOM = {
  blur: 1.5,
  brightness: 1.35,
  saturate: 1.4,
  opacity: 0.7,
} as const;

/**
 * What a colour swatch shows: the hue, and the light the bloom lifts it into
 * where the dither is dense. The same sum `ditherArea` composites, one
 * channel clamping at a time, so the swatch cannot promise a glow the chart
 * does not draw.
 */
export function posterSwatch(color: PosterColor): { hue: string; glow: string } {
  const hue = PALETTE[color].fill;
  const lift = 1 + BLOOM.opacity * BLOOM.brightness;
  const glow = hue.map((channel) =>
    Math.min(255, Math.round(channel * lift))
  ) as Rgb;
  const css = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;
  return { hue: css(hue), glow: css(glow) };
}

export type PosterTheme = "light" | "dark";

/** The stat row's figures a poster can carry, in the order they are drawn. */
export const POSTER_METRICS = [
  "visitors",
  "pageviews",
  "bounce",
  "revenue",
] as const;
export type PosterMetricKey = (typeof POSTER_METRICS)[number];

export type PosterMetric = {
  key: PosterMetricKey;
  label: string;
  /** Already formatted, by the same code the stat card uses. */
  value: string;
};

/** One line of a ranked list: a source, a country or a page. */
export type PosterRow = {
  label: string;
  /** Set in the page's own monospace: a path. */
  mono?: boolean;
  value: number;
  /** The row's mark: a favicon in a rounded square, a flag in a disc. */
  image: CanvasImageSource | null;
  imageShape: "square" | "round";
  /** What stands in when there is no image: a rank, or Direct's arrow. */
  fallback: "rank" | "direct";
};

export type PosterList = {
  /** "Top sources", the card's own title. */
  title: string;
  /** "12,431 visitors from 38 sources": the whole these rows are the top of. */
  whole: string;
  rows: readonly PosterRow[];
};

export type PosterRealtime = {
  count: number;
  /** The busiest paths right now, most people first. */
  pages: readonly { path: string; people: number }[];
  /** Where they are, most people first: the flag, the name, the count. */
  countries: readonly {
    name: string;
    image: CanvasImageSource | null;
    people: number;
  }[];
};

export type PosterModel = {
  kind: PosterKind;
  site: {
    name: string;
    /** The site's own favicon, or null for the initial tile. */
    favicon: CanvasImageSource | null;
  };
  period: {
    /** "Last 30 days", the picker's own words; "Right now" for realtime. */
    label: string;
    /** "Aug 3 to Sep 1, 2026", in the range's zone. */
    dates: string;
  };
  /** The figures chosen and available, in display order (overview). */
  metrics: readonly PosterMetric[];
  /** Visitors per bucket, exactly as the chart plotted them (overview). */
  series: readonly number[];
  /** "Source: Google · Country: Germany", or null when nothing filters. */
  filters: string | null;
  /** The ranked list (sources, countries, pages). */
  list: PosterList | null;
  /** The people on the site now (realtime). */
  realtime: PosterRealtime | null;
};

export type PosterLook = {
  theme: PosterTheme;
  color: PosterColor;
  chart: boolean;
  /** The two halves of the site's brand, each its own switch: some want
   * the name without the mark, some the mark without the name. */
  showName: boolean;
  showIcon: boolean;
  /** The lists' own switches (Abbas, 2026-09-06): the figure beside each
   * row, the line under the title that says what whole the rows are the
   * top of, and the rank tiles a page row wears in place of a mark. */
  values: boolean;
  summary: boolean;
  ranks: boolean;
  /** The realtime poster's two lists beside the count: the busiest paths,
   * and the country pills along the floor. */
  livePages: boolean;
  liveCountries: boolean;
};

const BRAND_NAME = "Open Analytics";

const MARGIN = 72;
const RIGHT = POSTER_WIDTH - MARGIN;
const CONTENT_WIDTH = RIGHT - MARGIN;
/** CSS pixels per dither cell: twice the dashboard's, since the poster is
 * read at half its size once a social card has shrunk it. */
const CHART_CELL = 4;
/** The rail: the site's column, a hairline, then the body. */
const RAIL_LINE_X = 388;
const RAIL_BODY_X = 436;
const RAIL_TOP = 72;
const RAIL_BOTTOM = POSTER_HEIGHT - 72;
/** How many rows a list prints: the five the cards themselves lead with. */
const LIST_ROWS = 5;

/** A fixed stack for paths: local faces, nothing to load. */
const MONO_FAMILY =
  'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

type Palette = {
  ground: string;
  ink: string;
  muted: string;
  faint: string;
  hairline: string;
  /** A surface a notch off the ground: the stamp pill, a track, a tile. */
  card: string;
  pill: string;
  /** An unlit dot in the realtime crowd. */
  dotOff: string;
  /** The value bars and the lit dots. */
  accent: string;
  live: string;
  /** The initial tile when a site has no favicon: the brand primary. */
  tile: string;
  /** Our mark, wherever it signs: its own blue on the light ground
   * (Abbas, 2026-09-06), and the muted ink on the dark one, where the blue
   * would sink into the charcoal and a signature should not shout. */
  mark: string;
};

/**
 * The product's own tokens (`globals.css`), stated here because a canvas
 * cannot read CSS variables and the file must not depend on the page's
 * theme: a dark-mode user still gets a light poster when they ask for one.
 * The dark ground is the tab bar's material (`#26262a`), a charcoal with a
 * little blue in it, rather than the near-black it was: a dark poster is
 * recognisably the product and not a black rectangle with numbers on it
 * (Abbas, 2026-09-06).
 */
const THEMES: Record<PosterTheme, Palette> = {
  light: {
    ground: "#f6f6f6",
    ink: "#292929",
    muted: "#6d6d6d",
    faint: "#9a9a9a",
    hairline: "rgba(41,41,41,0.1)",
    card: "#ffffff",
    pill: "rgba(41,41,41,0.06)",
    dotOff: "rgba(41,41,41,0.1)",
    accent: "#305dde",
    live: "#10b981",
    tile: "#305dde",
    mark: "#305dde",
  },
  dark: {
    ground: "#26262a",
    ink: "#ededed",
    muted: "#a1a1a8",
    faint: "#77777f",
    hairline: "rgba(255,255,255,0.1)",
    card: "#303036",
    pill: "rgba(255,255,255,0.08)",
    dotOff: "rgba(255,255,255,0.1)",
    accent: "#6b95ff",
    live: "#34d399",
    tile: "#296ff0",
    mark: "#a1a1a8",
  },
};

function font(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`;
}

/** The brand mark, from the same geometry `Logo` renders. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 512, size / 512);
  ctx.clip(new Path2D(RING_PATH), "evenodd");
  ctx.fillStyle = color;
  for (const top of BAND_TOPS) ctx.fillRect(0, top, 512, BAND_HEIGHT);
  ctx.fillRect(0, BASE_TOP, 512, 512 - BASE_TOP);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  fontSpec: string,
  color: string,
  align: CanvasTextAlign = "left",
  spacing = "0px"
): void {
  ctx.font = fontSpec;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.letterSpacing = spacing;
  ctx.fillText(value, x, y);
}

/**
 * The width `value` will take in `fontSpec` at `spacing`. `text()` leaves
 * the context's letter spacing at whatever it last drew with, and a
 * measurement taken after a figure drawn at minus a pixel and a fraction
 * per letter came out short: the stamp's pill was sized off it and its
 * name ran past its end (Abbas, 2026-09-06). So nothing here measures
 * without first stating both.
 */
function width(
  ctx: CanvasRenderingContext2D,
  value: string,
  fontSpec: string,
  spacing = "0px"
): number {
  ctx.font = fontSpec;
  ctx.letterSpacing = spacing;
  return ctx.measureText(value).width;
}

/** `value` cut to `maxWidth` with an ellipsis, in `fontSpec` at `spacing`. */
function fit(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  fontSpec: string,
  spacing = "0px"
): string {
  ctx.font = fontSpec;
  ctx.letterSpacing = spacing;
  if (ctx.measureText(value).width <= maxWidth) return value;
  let end = value.length;
  while (end > 1) {
    end -= 1;
    const cut = `${value.slice(0, end).trimEnd()}…`;
    if (ctx.measureText(cut).width <= maxWidth) return cut;
  }
  return "…";
}

function hairline(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
  height = 1
): void {
  ctx.fillStyle = palette.hairline;
  ctx.fillRect(x, y, width, height);
}

/* The chart -------------------------------------------------------------- */

/**
 * Monotone cubic interpolation (Fritsch and Carlson) through the buckets,
 * sampled per column. The kit's own smooth curve is a smoothstep on each
 * segment, which flattens at every bucket and turns a climb into a stair
 * with rounded treads; still a touch sharp on the poster (Abbas,
 * 2026-09-06). This one carries the slope through a bucket and only
 * flattens at a real peak or trough, where the slope is zero by
 * construction, so the tops come out round and the runs between them stay
 * one motion. It never overshoots: a spike keeps the height the data says
 * and a flat stretch stays flat. The knots are one unit apart, which is
 * what lets the Hermite basis be written without a step size.
 */
export function monotoneSampler(series: readonly number[]): (t: number) => number {
  const n = series.length;
  if (n < 2) return () => series[0] ?? 0;
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) delta.push(series[i + 1] - series[i]);
  const slope: number[] = new Array<number>(n).fill(0);
  slope[0] = delta[0];
  slope[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    slope[i] =
      delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      slope[i] = 0;
      slope[i + 1] = 0;
      continue;
    }
    const a = slope[i] / delta[i];
    const b = slope[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      slope[i] = tau * a * delta[i];
      slope[i + 1] = tau * b * delta[i];
    }
  }
  return (t) => {
    const i = Math.max(0, Math.min(Math.floor(t), n - 2));
    const f = t - i;
    const h00 = (1 + 2 * f) * (1 - f) * (1 - f);
    const h10 = f * (1 - f) * (1 - f);
    const h01 = f * f * (3 - 2 * f);
    const h11 = f * f * (f - 1);
    return (
      h00 * series[i] + h10 * slope[i] + h01 * series[i + 1] + h11 * slope[i + 1]
    );
  };
}

/** A scratch canvas beside the one being drawn, at the size asked for. */
function scratch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = ctx.canvas.ownerDocument.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const scratchCtx = canvas.getContext("2d");
  if (!scratchCtx) throw new Error("The poster needs a 2D canvas context");
  return { canvas, ctx: scratchCtx };
}

/**
 * The dashboard's sparkline, drawn the way Atlas draws its cards and chosen
 * for the poster on 2026-09-06 (Abbas): the dither-kit's own column paint on
 * a low-resolution backing, scaled up without smoothing so the cells stay
 * square, a smooth curve through the buckets, and the "low" bloom on top.
 *
 * The bloom is what the colours are about. A blurred copy of the dither is
 * added to the crisp one, so where the fill is dense, at the floor, each
 * channel saturates in turn and blue lifts into cyan, purple into pink,
 * orange into yellow, while the thin top stays the hue. Light from below in
 * the colour's own bright neighbour, without a second palette. On the
 * dashboard that copy is a second canvas under a CSS filter with
 * `mix-blend-mode: plus-lighter`; here it is the same backing drawn again
 * through the context's `filter` with the `lighter` operation, which is the
 * same sum. A browser without a canvas filter (Safari before 18) gets the
 * smoothed upscale as its blur, brightness and saturation left out: a
 * softer glow, not a missing one.
 *
 * The backing's floor is its last row, painted through, so the fill meets
 * the poster's bottom edge; a bucket at zero is clamped to that row and
 * draws the kit's outline there, the thin line along the floor that a flat
 * stretch shows on the dashboard too.
 */
function ditherArea(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  series: readonly number[],
  color: PosterColor
): void {
  const seed = PALETTE[color];
  const cols = Math.floor(width / CHART_CELL);
  const rows = Math.floor(height / CHART_CELL);
  const max = Math.max(...series, 1) * 1.12;
  const backing = scratch(ctx, cols, rows);
  // Interpolated on the values and mapped to rows afterwards, so the clamp
  // to the floor row applies to the curve and a run of zeros stays on it.
  const sample = monotoneSampler(series);
  const last = series.length - 1;
  const tops: number[] = [];
  for (let column = 0; column < cols; column++) {
    const value = sample((column / Math.max(cols - 1, 1)) * last);
    tops.push(Math.min(rows - 1, (1 - value / max) * rows));
  }
  for (let column = 0; column < cols; column++) {
    paintColumn(backing.ctx, column, tops[column], rows, seed, {
      variant: "gradient",
      intensity: 0,
      dim: 1,
      stacked: false,
    });
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dx = x * POSTER_SCALE;
  const dy = y * POSTER_SCALE;
  const dw = width * POSTER_SCALE;
  const dh = height * POSTER_SCALE;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(backing.canvas, dx, dy, dw, dh);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = BLOOM.opacity;
  ctx.imageSmoothingEnabled = true;
  if ("filter" in ctx) {
    // Device pixels: the transform is identity here on purpose, so the blur
    // is the same number of cells whatever scale the poster is drawn at.
    const blur = BLOOM.blur * CHART_CELL * POSTER_SCALE;
    ctx.filter = `blur(${blur}px) brightness(${BLOOM.brightness}) saturate(${BLOOM.saturate})`;
  }
  ctx.drawImage(backing.canvas, dx, dy, dw, dh);
  ctx.restore();
}

/* Marks and tiles --------------------------------------------------------- */

function siteTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  site: PosterModel["site"],
  palette: Palette,
  family: string
): void {
  ctx.save();
  roundedRect(ctx, x, y, size, size, size * 0.28);
  if (site.favicon) {
    ctx.clip();
    ctx.drawImage(site.favicon, x, y, size, size);
  } else {
    ctx.fillStyle = palette.tile;
    ctx.fill();
    const initial = site.name.trim().charAt(0).toUpperCase() || "?";
    text(
      ctx,
      initial,
      x + size / 2,
      y + size * 0.69,
      font(500, size * 0.58, family),
      "#ffffff",
      "center"
    );
  }
  ctx.restore();
}

/** A row's mark: its image in a rounded square or a disc, else a tile. */
function rowMark(
  ctx: CanvasRenderingContext2D,
  row: PosterRow,
  rank: number,
  x: number,
  y: number,
  size: number,
  palette: Palette,
  family: string
): void {
  ctx.save();
  if (row.image) {
    roundedRect(
      ctx,
      x,
      y,
      size,
      size,
      row.imageShape === "round" ? size / 2 : size * 0.26
    );
    ctx.clip();
    ctx.drawImage(row.image, x, y, size, size);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = palette.pill;
  ctx.fill();
  if (row.fallback === "rank") {
    text(
      ctx,
      String(rank),
      x + size / 2,
      y + size * 0.67,
      font(500, size * 0.46, family),
      palette.muted,
      "center"
    );
  } else {
    // Direct: the arrow the sources card wears for it.
    const cx = x + size / 2;
    const cy = y + size / 2;
    const reach = size * 0.2;
    ctx.strokeStyle = palette.muted;
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - reach, cy);
    ctx.lineTo(cx + reach, cy);
    ctx.moveTo(cx + reach * 0.3, cy - reach * 0.7);
    ctx.lineTo(cx + reach, cy);
    ctx.lineTo(cx + reach * 0.3, cy + reach * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

/** A value bar: the track, then the share of the row's own top. */
function bar(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  x: number,
  y: number,
  width: number,
  share: number,
  height = 6
): void {
  ctx.save();
  roundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = palette.hairline;
  ctx.fill();
  const filled = Math.max(height, width * Math.min(1, Math.max(0, share)));
  roundedRect(ctx, x, y, filled, height, height / 2);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.restore();
}

/* Headers: the site's brand, per frame ------------------------------------ */

/** The site's mark and name on one line, whichever halves are shown. */
function brandLine(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string,
  x: number,
  top: number,
  markSize: number,
  nameSize: number,
  gap: number
): void {
  let cursor = x;
  if (look.showIcon) {
    siteTile(ctx, cursor, top, markSize, model.site, palette, family);
    cursor += markSize + gap;
  }
  if (look.showName) {
    // Centred on the mark: a lowercase-heavy name sits on the baseline the
    // mark's centre plus a third of the size lands on.
    text(
      ctx,
      model.site.name,
      cursor,
      top + markSize / 2 + nameSize * 0.36,
      font(500, nameSize, family),
      palette.ink,
      "left",
      `${-nameSize / 60}px`
    );
  }
}

/** Always printed while a filter is on: filtered rows under an unqualified
 * headline would present one population as the whole site. */
function filtersPill(
  ctx: CanvasRenderingContext2D,
  filters: string,
  palette: Palette,
  family: string,
  x: number,
  top: number,
  maxWidth: number
): void {
  const pillFont = font(400, 16, family);
  const label = fit(ctx, `Filtered · ${filters}`, maxWidth - 28, pillFont);
  const pillWidth = width(ctx, label, pillFont) + 28;
  roundedRect(ctx, x, top, pillWidth, 30, 15);
  ctx.fillStyle = palette.pill;
  ctx.fill();
  text(ctx, label, x + 14, top + 21, pillFont, palette.ink);
}

/* Frames ------------------------------------------------------------------ */

/**
 * The headline: the site across the top, the period in the corner. The
 * signature itself is `stampSignature`, drawn after the body, since the
 * chart runs under it and a pill painted first was painted over (Abbas,
 * 2026-09-06). Returns where the body may start.
 */
function headlineFrame(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string
): number {
  brandLine(ctx, model, look, palette, family, MARGIN, 60, 48, 40, 16);
  // The period in the top-right corner, where our brand stood before the
  // stamp (Abbas, 2026-09-06): the window on one line, its dates under.
  // There whatever the brand switches say; with both off the left is
  // simply empty rather than the period moving over to fill it.
  text(ctx, model.period.label, RIGHT, 80, font(500, 18, family), palette.ink, "right");
  text(ctx, model.period.dates, RIGHT, 104, font(400, 15, family), palette.muted, "right");
  const lastLine = 108;
  let bodyTop = 184;
  if (model.filters) {
    filtersPill(ctx, model.filters, palette, family, MARGIN, lastLine + 18, CONTENT_WIDTH);
    bodyTop = Math.max(bodyTop, lastLine + 18 + 30 + 28);
  }
  return bodyTop;
}

/**
 * A tab growing out of the bottom edge: rounded at the top, and at the
 * foot curving *outward* into the edge on both sides, the way a label
 * pulled up out of a slot carries a little of the slot with it. The
 * outline runs along the visible back only; the foot is the edge itself.
 */
function tabPath(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
  corner: number,
  fillet: number
): void {
  ctx.beginPath();
  ctx.moveTo(left - fillet, bottom);
  // A quadratic with its control on the corner bends toward the corner:
  // the concave fillet, not a convex one.
  ctx.quadraticCurveTo(left, bottom, left, bottom - fillet);
  ctx.lineTo(left, top + corner);
  ctx.arcTo(left, top, left + corner, top, corner);
  ctx.lineTo(right - corner, top);
  ctx.arcTo(right, top, right, top + corner, corner);
  ctx.lineTo(right, bottom - fillet);
  ctx.quadraticCurveTo(right, bottom, right + fillet, bottom);
}

/**
 * The stamp itself: bottom centre, flush with the bottom edge, a tab
 * grown out of it rather than a pill floating above it (Abbas,
 * 2026-09-06). Mark and our name; the domain rode beside them for a day
 * and came off, since the name is the signature and the domain made the
 * tab a footer.
 *
 * In the poster's own theme: the card surface a notch off the ground, the
 * ink, the mark's own colour. It wore the other theme's colours for a
 * minute and came back (Abbas, 2026-09-06): the tab is part of the
 * picture, not a badge stuck on it.
 */
function stampSignature(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  family: string
): void {
  const nameFont = font(500, 15, family);
  const nameWidth = width(ctx, BRAND_NAME, nameFont);
  const markSize = 20;
  const padX = 18;
  const gap = 10;
  const tabWidth = padX + markSize + gap + nameWidth + padX;
  const height = 46;
  const corner = 16;
  const fillet = 12;
  const left = (POSTER_WIDTH - tabWidth) / 2;
  const right = left + tabWidth;
  const top = POSTER_HEIGHT - height;
  const bottom = POSTER_HEIGHT;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.1)";
  ctx.shadowBlur = 6 * POSTER_SCALE;
  ctx.shadowOffsetY = -1 * POSTER_SCALE;
  tabPath(ctx, left, right, top, bottom, corner, fillet);
  ctx.closePath();
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.restore();

  ctx.save();
  tabPath(ctx, left, right, top + 0.5, bottom, corner, fillet);
  ctx.strokeStyle = palette.hairline;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // The contents sit a touch above the tab's centre: the bottom is the
  // picture's edge, and a line resting on an edge reads as cut off.
  const centre = top + height / 2 - 2;
  let cursor = left + padX;
  drawMark(ctx, cursor, centre - markSize / 2, markSize, palette.mark);
  cursor += markSize + gap;
  text(ctx, BRAND_NAME, cursor, centre + 5, nameFont, palette.ink);
}

/** The rail: realtime and pages. The body's column is fixed. */
function railFrame(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string
): void {
  let y = RAIL_TOP;
  if (look.showIcon) {
    siteTile(ctx, MARGIN, y, 64, model.site, palette, family);
    y += 88;
  }
  const railWidth = RAIL_LINE_X - MARGIN - 24;
  if (look.showName) {
    const nameFont = font(500, 32, family);
    text(
      ctx,
      fit(ctx, model.site.name, railWidth, nameFont, "-0.6px"),
      MARGIN,
      y + 27,
      nameFont,
      palette.ink,
      "left",
      "-0.6px"
    );
    y += 32 + 14;
  }
  let lastLine: number;
  if (look.showName || look.showIcon) {
    text(ctx, model.period.label, MARGIN, y + 15, font(400, 18, family), palette.muted);
    y += 18 + 8;
    text(ctx, model.period.dates, MARGIN, y + 12, font(400, 15, family), palette.faint);
    lastLine = y + 12;
  } else {
    text(
      ctx,
      model.period.label,
      MARGIN,
      y + 27,
      font(500, 32, family),
      palette.ink,
      "left",
      "-0.6px"
    );
    y += 32 + 14;
    text(ctx, model.period.dates, MARGIN, y + 12, font(400, 15, family), palette.faint);
    lastLine = y + 12;
  }
  if (model.filters) {
    filtersPill(ctx, model.filters, palette, family, MARGIN, lastLine + 18, railWidth);
  }

  hairline(ctx, palette, RAIL_LINE_X, RAIL_TOP, 1, RAIL_BOTTOM - RAIL_TOP);
}

/* Bodies ------------------------------------------------------------------ */

function overviewBody(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string,
  bodyTop: number
): void {
  const chart = look.chart && model.series.length >= 2;
  const chartTop = 398;
  // The figures share the width evenly; fewer of them get bigger type, and
  // without a chart they drop to the vertical centre of what is left.
  const count = model.metrics.length;
  if (count > 0) {
    const size = count <= 2 ? 96 : count === 3 ? 80 : 72;
    const labelY = chart ? bodyTop + 14 : 336;
    const valueY = labelY + size * 0.92;
    const column = CONTENT_WIDTH / count;
    model.metrics.forEach((metric, index) => {
      const x = MARGIN + index * column;
      text(
        ctx,
        metric.label.toUpperCase(),
        x,
        labelY,
        font(500, 14, family),
        palette.muted,
        "left",
        "1.6px"
      );
      text(
        ctx,
        metric.value,
        x,
        valueY,
        font(500, size, family),
        palette.ink,
        "left",
        `${-size / 60}px`
      );
    });
  }
  if (chart) {
    ditherArea(
      ctx,
      0,
      chartTop,
      POSTER_WIDTH,
      POSTER_HEIGHT - chartTop,
      model.series,
      look.color
    );
  }
}

/** Title and the whole it is the top of, on one baseline. */
function listHeading(
  ctx: CanvasRenderingContext2D,
  list: PosterList,
  palette: Palette,
  family: string,
  x: number,
  baseline: number,
  size: number,
  maxWidth: number,
  summary: boolean
): void {
  const titleFont = font(500, size, family);
  const tracking = `${-size / 60}px`;
  text(ctx, list.title, x, baseline, titleFont, palette.ink, "left", tracking);
  if (!summary) return;
  const titleWidth = width(ctx, list.title, titleFont, tracking);
  const wholeFont = font(400, Math.round(size * 0.75), family);
  const whole = fit(ctx, list.whole, maxWidth - titleWidth - 14, wholeFont);
  text(ctx, whole, x + titleWidth + 14, baseline, wholeFont, palette.muted);
}

/**
 * The rows: mark, name, value, and a bar of the row's share of the top.
 * Without marks the text starts at the margin; without values the bar and
 * the name have the whole width.
 */
function listRows(
  ctx: CanvasRenderingContext2D,
  list: PosterList,
  palette: Palette,
  family: string,
  x: number,
  right: number,
  top: number,
  rowHeight: number,
  markSize: number,
  textSize: number,
  values: boolean,
  marks: boolean
): void {
  const rows = list.rows.slice(0, LIST_ROWS);
  const first = rows[0]?.value ?? 1;
  rows.forEach((row, index) => {
    const rowTop = top + index * rowHeight;
    if (marks) rowMark(ctx, row, index + 1, x, rowTop, markSize, palette, family);
    const textX = marks ? x + markSize + 14 : x;
    const baseline = rowTop + markSize / 2 + textSize * 0.36;
    let valueWidth = 0;
    if (values) {
      const valueFont = font(500, textSize, family);
      const value = row.value.toLocaleString("en-US");
      valueWidth = width(ctx, value, valueFont) + 24;
      text(ctx, value, right, baseline, valueFont, palette.ink, "right");
    }
    const nameFont = row.mono
      ? font(500, textSize, MONO_FAMILY)
      : font(500, textSize, family);
    const tracking = row.mono ? "0px" : "-0.2px";
    const label = fit(ctx, row.label, right - valueWidth - textX, nameFont, tracking);
    text(ctx, label, textX, baseline, nameFont, palette.ink, "left", tracking);
    bar(ctx, palette, textX, rowTop + markSize + 10, right - textX, first > 0 ? row.value / first : 0);
  });
}

function listBody(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string,
  bodyTop: number
): void {
  if (!model.list) return;
  listHeading(ctx, model.list, palette, family, MARGIN, bodyTop + 19, 22, CONTENT_WIDTH, look.summary);
  // The marks here are favicons and flags, the rows' identity, so they stay.
  listRows(ctx, model.list, palette, family, MARGIN, RIGHT, bodyTop + 44, 62, 30, 20, look.values, true);
}

function pagesBody(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string
): void {
  if (!model.list) return;
  const width = RIGHT - RAIL_BODY_X;
  listHeading(ctx, model.list, palette, family, RAIL_BODY_X, RAIL_TOP + 21, 24, width, look.summary);
  // A little more air under the heading than the byline's list has: the
  // rail's rows are taller, and the title read as the first of them.
  listRows(ctx, model.list, palette, family, RAIL_BODY_X, RIGHT, RAIL_TOP + 64, 76, 30, 20, look.values, look.ranks);
}

/**
 * The realtime body, the rail's without the chart (Abbas, 2026-09-06): the
 * count with its live dot, the busiest paths right now beside it, and
 * under the count the three countries most of them are in, as pills. The
 * crowd of dots that filled the floor went the same day; the count is the
 * picture, and a field of dots under it was a second, vaguer count.
 */
function realtimeBody(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  palette: Palette,
  family: string
): void {
  const live = model.realtime;
  if (!live) return;
  const x = RAIL_BODY_X;

  // The live dot with its halo, then the caps.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + 12, RAIL_TOP + 12, 12, 0, Math.PI * 2);
  ctx.fillStyle = `${palette.live}33`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 12, RAIL_TOP + 12, 6, 0, Math.PI * 2);
  ctx.fillStyle = palette.live;
  ctx.fill();
  ctx.restore();
  text(ctx, "RIGHT NOW", x + 36, RAIL_TOP + 17, font(500, 14, family), palette.muted, "left", "1.6px");

  const size = 120;
  const numberTop = RAIL_TOP + 24 + 22;
  text(
    ctx,
    live.count.toLocaleString("en-US"),
    x,
    numberTop + size * 0.92,
    font(500, size, family),
    palette.ink,
    "left",
    `${-size / 60}px`
  );
  const captionY = numberTop + size + 16 + 17;
  text(
    ctx,
    live.count === 1 ? "person on the site" : "people on the site",
    x,
    captionY,
    font(400, 20, family),
    palette.muted
  );

  // The busiest paths, top right of the body, a notch larger than a list
  // row: they are the second thing the poster says.
  const listWidth = 380;
  const listX = RIGHT - listWidth;
  const pages = look.livePages ? live.pages.slice(0, 4) : [];
  if (pages.length > 0) {
    text(ctx, "WHERE THEY ARE", listX, RAIL_TOP + 14, font(500, 14, family), palette.muted, "left", "1.6px");
  }
  pages.forEach((page, index) => {
    const baseline = RAIL_TOP + 14 + 26 + 20 + index * 40;
    const valueFont = font(400, 20, family);
    const value = page.people.toLocaleString("en-US");
    const valueWidth = width(ctx, value, valueFont);
    text(ctx, value, RIGHT, baseline, valueFont, palette.muted, "right");
    const pathFont = font(500, 20, MONO_FAMILY);
    text(ctx, fit(ctx, page.path, listWidth - valueWidth - 18, pathFont), listX, baseline, pathFont, palette.ink);
  });

  // Where they are: up to three pills under the count, each a flag, a name
  // and a count, and no more than fit before the right margin.
  const pillHeight = 40;
  // Right under the count's caption rather than on the rail's floor: they
  // are part of the count's sentence, and on the floor they crowded the
  // tab growing out of the edge below (Abbas, 2026-09-06).
  const pillTop = captionY + 44;
  const flag = 24;
  const nameFont = font(500, 17, family);
  const countFont = font(400, 17, family);
  let cursor = x;
  const countries = look.liveCountries ? live.countries.slice(0, 3) : [];
  for (const country of countries) {
    const nameWidth = width(ctx, country.name, nameFont);
    const count = country.people.toLocaleString("en-US");
    const countWidth = width(ctx, count, countFont);
    const pillWidth = 8 + flag + 10 + nameWidth + 10 + countWidth + 16;
    if (cursor + pillWidth > RIGHT) break;
    roundedRect(ctx, cursor, pillTop, pillWidth, pillHeight, pillHeight / 2);
    ctx.fillStyle = palette.pill;
    ctx.fill();
    const flagX = cursor + 8;
    const flagY = pillTop + (pillHeight - flag) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(flagX + flag / 2, flagY + flag / 2, flag / 2, 0, Math.PI * 2);
    if (country.image) {
      ctx.clip();
      ctx.drawImage(country.image, flagX, flagY, flag, flag);
    } else {
      ctx.fillStyle = palette.dotOff;
      ctx.fill();
    }
    ctx.restore();
    const baseline = pillTop + pillHeight / 2 + 6;
    text(ctx, country.name, flagX + flag + 10, baseline, nameFont, palette.ink);
    text(ctx, count, flagX + flag + 10 + nameWidth + 10, baseline, countFont, palette.muted);
    cursor += pillWidth + 12;
  }
}

/**
 * Draws the whole poster into `ctx`, which must belong to a canvas of
 * `POSTER_WIDTH × POSTER_SCALE` by `POSTER_HEIGHT × POSTER_SCALE`. `family`
 * is the page's own sans family, loaded beforehand (`ensurePosterFonts`);
 * a canvas will not wait for a font the way the DOM does.
 */
export function drawPoster(
  ctx: CanvasRenderingContext2D,
  model: PosterModel,
  look: PosterLook,
  family: string
): void {
  // The bars and the crowd wear the chart's own hue, so the colour picked
  // for one poster is the colour of every poster.
  const [r, g, b] = PALETTE[look.color].fill;
  const palette: Palette = {
    ...THEMES[look.theme],
    accent: `rgb(${r}, ${g}, ${b})`,
  };
  ctx.setTransform(POSTER_SCALE, 0, 0, POSTER_SCALE, 0, 0);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);

  switch (model.kind) {
    case "overview": {
      const bodyTop = headlineFrame(ctx, model, look, palette, family);
      overviewBody(ctx, model, look, palette, family, bodyTop);
      break;
    }
    case "sources":
    case "countries": {
      const bodyTop = headlineFrame(ctx, model, look, palette, family);
      listBody(ctx, model, look, palette, family, bodyTop);
      break;
    }
    case "pages":
      railFrame(ctx, model, look, palette, family);
      pagesBody(ctx, model, look, palette, family);
      break;
    case "realtime":
      railFrame(ctx, model, look, palette, family);
      realtimeBody(ctx, model, look, palette, family);
      break;
  }
  // Last, over everything: the chart runs under it on the overview.
  stampSignature(ctx, palette, family);
}

/** `kanba-co-sources-last-30-days.png`: the site, the poster, the range. */
export function posterFileName(
  siteName: string,
  kind: PosterKind,
  periodLabel: string
): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [slug(siteName), slug(POSTER_KIND_LABEL[kind]), slug(periodLabel)].filter(
    (part) => part !== ""
  );
  return `${parts.join("-") || "poster"}.png`;
}
