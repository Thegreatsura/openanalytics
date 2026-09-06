"use client";

import { Share01Icon } from "hugeicons-react";
import { AnimatePresence } from "motion/react";
import { useParams } from "next/navigation";
import * as React from "react";
import { useAnalyticsFilters } from "@/components/dashboard/filter-context";
import { useAnalyticsInterval } from "@/components/dashboard/interval-context";
import { OverviewPosterModal } from "@/components/dashboard/overview-poster-modal";
import {
  posterKey,
  useOverviewPosterStore,
} from "@/components/dashboard/overview-poster-store";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The overview header's Share button: opens the poster modal once the stat
 * row has published numbers for the screen's current range.
 *
 * Disabled with a reason rather than silently: a range still loading, a
 * true empty and a pipeline that is behind are three different answers to
 * "why not", and the one thing this must never do is hand somebody a
 * picture of numbers the card itself is still caveating.
 */
export function ShareOverviewButton() {
  const params = useParams<{ site: string }>();
  const slug = params.site ? decodeURIComponent(params.site) : "";
  const { range, rangePending } = useAnalyticsInterval();
  const { filtersParam } = useAnalyticsFilters();
  const store = useOverviewPosterStore();
  const [open, setOpen] = React.useState(false);

  const key = posterKey(slug, range, filtersParam);
  const totals =
    !rangePending && store.totals?.key === key ? store.totals : null;
  const reason =
    totals === null
      ? "Waiting for the numbers"
      : totals.state === "empty"
        ? "Nothing to share yet"
        : totals.state !== "ok"
          ? "The numbers are still catching up"
          : null;

  // A bare `s` opens the modal, the refresh button's `r` rule for rules:
  // only as a command (not while typing, not held, never with a modifier
  // that makes it the browser's), and only while the button itself would
  // open (Abbas, 2026-09-06).
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "s" && event.key !== "S") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat)
        return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (reason !== null) return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reason]);

  // `aria-disabled` rather than `disabled`: a disabled button takes no
  // pointer events, and the tooltip is the whole point of the state.
  const button = (
    <Button
      aria-disabled={reason !== null}
      className={cn(reason !== null && "opacity-50")}
      onClick={() => {
        if (reason === null) setOpen(true);
      }}
      size="sm"
      title="Share (S)"
      variant="outline"
    >
      <Share01Icon aria-hidden="true" />
      Share
      {/* The onboarding Enter chip's recipe, not the refresh button's: this
          button is the outline variant, which here is the tab bar's charcoal
          with light text, and the shared Kbd's muted fill and ink vanished on
          it (Abbas, 2026-09-06). A grey keycap, white letter. Hidden on a
          phone, where there is no S to press. */}
      <Kbd className="-mr-0.5 h-4 min-w-4 rounded-[4px] bg-[#45454c] px-1 text-[11px] text-white max-sm:hidden">
        S
      </Kbd>
    </Button>
  );

  return (
    <>
      {reason === null ? (
        button
      ) : (
        <Tooltip>
          <TooltipTrigger render={button} />
          <TooltipPopup>{reason}</TooltipPopup>
        </Tooltip>
      )}
      <AnimatePresence>
        {open ? <OverviewPosterModal onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </>
  );
}
