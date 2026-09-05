"use client";

import { useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Job } from "@contracts/types";

import { Button } from "@/components/ui/button";
import { HistoryItem, HistoryItemContent } from "@/components/analyze/history-item";
import { AestheticCompareModal } from "@/components/history/aesthetic-compare-modal";
import { useCompare } from "@/components/history/compare-context";

type DoneJob = Job & { result: NonNullable<Job["result"]> };

// Checked state uses one fixed color (primary) regardless of which song —
// per-song identity colors only matter inside the comparison charts
// themselves, not this checkbox.
function SelectableHistoryRow({ job, checked, onToggle }: { job: DoneJob; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      }`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${
          checked ? "border-primary bg-primary" : "border-border"
        }`}
      >
        {checked && <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />}
      </span>
      <HistoryItemContent job={job} />
    </button>
  );
}

// Only used on the /history page — RecentAnalysisList (analyze-workspace's
// "recent analyses" preview) has no compare button and stays untouched.
export function HistoryComparePanel({ jobs, title }: { jobs: Job[]; title: string }) {
  const t = useTranslations("Compare");
  const tHistory = useTranslations("History");
  const tRecent = useTranslations("Recent");
  const [downloading, setDownloading] = useState(false);
  const {
    compareMode,
    selectedSongs,
    showModal,
    limitHit,
    startCompare,
    cancelCompare,
    toggleSong,
    removeSong,
    openModal,
    closeModal,
  } = useCompare();

  // fetchJobs already filters to status=done, but the type is still Job|null
  // — narrow once here so downstream code can rely on `result` being present.
  const doneJobs = jobs.filter((j): j is DoneJob => j.result !== null);

  // Exports the full history (every done job, not just this page), not
  // just what fetchJobs(...) handed this page — a browser navigation to
  // /api/history/export would only stream a file, not trigger a download,
  // so this fetches the bytes itself and hands them to a throwaway <a>.
  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const res = await fetch("/api/history/export");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "computable-beauty-history.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
          <Button size="sm" variant="outline" disabled={downloading} onClick={handleDownloadAll}>
            {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {tHistory("downloadAll")}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {limitHit && <span className="text-xs text-destructive">{t("limitMessage")}</span>}
          {compareMode && (
            <>
              {selectedSongs.length >= 1 && (
                <span className="text-xs text-muted-foreground">{t("selectedCount", { count: selectedSongs.length })}</span>
              )}
              <Button size="sm" disabled={selectedSongs.length < 2} onClick={openModal}>
                {t("confirmCompare")}
              </Button>
              <Button size="sm" variant="outline" onClick={cancelCompare}>
                {t("cancelCompare")}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" disabled={compareMode} onClick={startCompare}>
            {t("compareButton")}
          </Button>
        </div>
      </div>

      {doneJobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">{tRecent("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {doneJobs.map((job) =>
            compareMode ? (
              <SelectableHistoryRow
                key={job.id}
                job={job}
                checked={selectedSongs.some((s) => s.id === job.id)}
                onToggle={() => toggleSong({ id: job.id, title: job.title, aesthetic: job.result.aesthetic })}
              />
            ) : (
              <HistoryItem key={job.id} job={job} />
            ),
          )}
        </div>
      )}

      {showModal && selectedSongs.length > 0 && (
        <AestheticCompareModal songs={selectedSongs} onRemove={removeSong} onClose={closeModal} />
      )}
    </section>
  );
}
