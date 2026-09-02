import {
  Code,
  DocArticle,
  DocCode,
  DocLink,
  DocList,
  DocNote,
  DocSection,
} from "@/components/docs/doc-prose";
import { docPage, docsMetadata } from "@/lib/docs";

const page = docPage("dashboard");
export const metadata = docsMetadata(page);

export default function DashboardDocsPage() {
  return (
    <DocArticle page={page}>
      <DocSection title="The layout">
        <p>
          A site&apos;s overview reads top to bottom: the headline totals
          (visitors, pageviews, bounce rate, average visit), the traffic
          chart, then the breakdowns: pages, sources, geography, devices and
          custom events. Every number answers the range picked in the
          header, and every breakdown is the same range cut a different way.
        </p>
      </DocSection>

      <DocSection title="Tag your own links">
        <p>
          Browsers send less and less referrer information every year, and
          some places send none at all &mdash; a link in a newsletter, a PDF,
          a chat app or an app&apos;s in-built browser usually arrives with
          nothing attached, which is why so much traffic reads as Direct.
          Adding a <Code>ref</Code> to the link fixes that, and there is
          nothing to turn on: if a visit arrives with no referrer of its own,
          the tag names the source.
        </p>
        <DocCode caption="Any link you control">{`https://example.com/?ref=twitter
https://example.com/pricing?ref=newsletter`}</DocCode>
        <DocList
          items={[
            "Known names are folded onto the site they mean, so ?ref=twitter lands in the same row as the visits X reports itself. A domain works too: ?ref=selfh.st.",
            "Anything else is kept exactly as you wrote it, so ?ref=newsletter is its own row in Sources — useful for the places that have no domain at all.",
            "A referrer the browser did send always wins. The tag only fills in what would otherwise be Direct, so a leftover ?ref on your own internal links cannot invent a visit.",
          ]}
        />
        <DocNote>
          Many sites already do this for you: Product Hunt appends{" "}
          <Code>?ref=producthunt</Code> to every outbound link, and so do most
          launch boards, directories and newsletters &mdash; those visits stop
          reading as Direct on their own. <Code>ref</Code> and UTM tags answer
          different questions and do not compete: <Code>utm_source</Code> and
          its companions are their own cuts of the Sources card, for campaigns
          you are running and measuring, while <Code>ref</Code> is a light way
          to name where a single link lives. A link may carry both. Tagging is
          only read going forward &mdash; it cannot relabel visits that already
          happened.
        </DocNote>
      </DocSection>

      <DocSection title="Ranges and comparisons">
        <DocList
          items={[
            "The interval picker covers today, yesterday, the last 7 and 30 days, month and year views, 6 and 12 months, and All time (anchored at your site's first event).",
            "Comparisons show the preceding equal-length period beside the current one, so a delta is always against something concrete.",
            "The chart picks its own grain honestly: hours for a day, days for a month, ISO weeks for 6 and 12 months. Weekly unique visitors are merged server-side, never summed from days, so uniques stay true.",
          ]}
        />
      </DocSection>

      <DocSection title="Whose clock cuts the day">
        <p>
          Charts follow your account timezone (or your browser&apos;s, until
          you pick one), so Today means your today. Widgets and public
          share pages have their own rules; the{" "}
          <DocLink slug="timezones">timezones page</DocLink> lays out all
          three clocks.
        </p>
      </DocSection>

      <DocSection title="Sessions and engagement">
        <p>
          A session is rebuilt server-side with a 30-minute inactivity rule;
          bounce rate and average visit duration come from it. Engagement
          time is measured with two clocks (visible time, and active time
          near a real interaction), so a tab parked in the background does
          not inflate anything.
        </p>
      </DocSection>

      <DocSection title="Freshness">
        <DocNote>
          Events typically land in charts within seconds. When the chip
          beside a card&apos;s title says Catching up, the pipeline is behind
          and the charts are honest about it; a site with no traffic simply
          shows its last visit&apos;s age. For the current moment, the{" "}
          <DocLink slug="realtime">realtime view</DocLink> is the faster
          surface.
        </DocNote>
      </DocSection>
    </DocArticle>
  );
}
