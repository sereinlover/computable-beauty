import Link from "next/link";
import { ArrowRight, Music2 } from "lucide-react";
import type { Job } from "@contracts/types";
import { useTranslations } from "next-intl";

import { formatDuration, formatExactTime, formatScore, relativeTimeParts } from "@/lib/format";

// Not async, and useTranslations (not getTranslations) — this file is used
// both from a Server Component (app/history/page.tsx) and directly inside a
// Client Component's own render (analyze-workspace.tsx's <RecentAnalysisList>
// isn't passed down as a children prop, it's imported and rendered inline).
// An async Server Component gets bundled for the client in that second case,
// and React can't render an async function component on the client at all —
// useTranslations has a react-server build that works in both contexts.
export function HistoryItem({ job }: { job: Job }) {
  const t = useTranslations("Result");
  const tRelative = useTranslations("RelativeTime");
  if (!job.result) return null;
  const { feature_summary, understanding, aesthetic } = job.result;
  const { unit, value } = relativeTimeParts(job.created_at ?? "");

  return (
    <Link
      href={`/result/${job.id}`}
      className="flex items-center gap-4 rounded-xl border border-border px-5 py-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Music2 className="size-4 text-primary" strokeWidth={1.5} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="group/title relative w-fit max-w-full">
          <p className="truncate font-medium text-foreground">
            {job.title} <span className="text-muted-foreground">— {job.artist || t("unknownArtist")}</span>
          </p>
          <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs whitespace-nowrap text-neutral-900 shadow-lg group-hover/title:block">
            {job.title} — {job.artist || t("unknownArtist")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDuration(feature_summary.duration_sec)} · {feature_summary.key} · {understanding.time_signature} ·{" "}
          {Math.round(feature_summary.bpm)} BPM · {tRelative(unit, { value })} ({formatExactTime(job.created_at ?? "")})
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span className="text-sm text-muted-foreground">{t("aestheticIndex")} </span>
        <span className="font-semibold text-primary">{formatScore(aesthetic.aesthetic_index)}</span>
      </div>
    </Link>
  );
}

export function RecentAnalysisList({
  jobs,
  title,
  viewAllHref,
}: {
  jobs: Job[];
  title?: string;
  viewAllHref?: string;
}) {
  const t = useTranslations("Recent");

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">{title ?? t("recentAnalyses")}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="group flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            {t("historyLink")}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <HistoryItem key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}
