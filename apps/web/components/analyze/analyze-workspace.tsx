"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Circle, CircleMinus, Loader2, Music, X } from "lucide-react";

import type { DemoTrack, DemoTracksResponse, Job, JobStatus, SSEEvent, ListJobResponse } from "@contracts/types";
import type { GatewayEnvelope } from "@/lib/gateway";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RecentAnalysisList } from "@/components/analyze/history-item";
import { formatDuration } from "@/lib/format";
import { useAnimatedProgress } from "@/lib/use-animated-progress";

// Same four steps/order as apps/gateway/internal/server/sse.go's sseStepInfo
// — Gateway's SSE messages are English, apps/web owns the translated copy
// (messages/*.json's "Step" namespace, shared with processing-view.tsx).
const STEP_ORDER: JobStatus[] = ["extracting", "classifying", "scoring", "explaining"];

// job.error is the authoritative source for which step failed — SSE's
// `step` comes from a 5s poll of a Redis-cached status (sse.go's
// ssePollInterval) and can skip past a step that only existed for a moment,
// which an LLM auth error reliably does (fails in ~1s). Matches
// pipeline.go's runPipeline error prefixes.
function stepIndexFromError(error: string): number {
  if (error.startsWith("failed to extract features")) return 0;
  if (error.startsWith("failed to classify")) return 1;
  if (error.startsWith("failed to score aesthetics")) return 2;
  if (error.startsWith("failed to explain")) return 3;
  return -1;
}

// Step-by-step record shown in a tooltip once a job finishes — the live
// in-progress checklist disappears once the card switches layout, so this
// is the only place that history survives. mode="completed" marks every
// step done except explaining (if explanationSkipped); mode="failed" marks
// steps before currentIndex done, currentIndex failed, the rest unreached.
function StepChecklist({
  mode,
  currentIndex,
  explanationSkipped,
}: {
  mode: "completed" | "failed";
  currentIndex: number;
  explanationSkipped?: boolean;
}) {
  const t = useTranslations("Step");
  const tAnalyze = useTranslations("Analyze");

  return (
    <ul className="space-y-1.5">
      {STEP_ORDER.map((s, i) => {
        const isSkippedHere = mode === "completed" && explanationSkipped && i === 3;
        const isFailedHere = mode === "failed" && currentIndex === i;
        const isDone = !isSkippedHere && (mode === "completed" || (mode === "failed" && currentIndex > i));
        return (
          <li key={s} className="flex items-center gap-2 text-xs whitespace-nowrap">
            {isSkippedHere ? (
              <CircleMinus className="size-3.5 shrink-0 text-muted-foreground" />
            ) : isFailedHere ? (
              <X className="size-3.5 shrink-0 text-destructive" />
            ) : isDone ? (
              <Check className="size-3.5 shrink-0 text-primary" />
            ) : (
              <Circle className="size-2.5 shrink-0 text-muted-foreground/40" />
            )}
            <span className={isFailedHere ? "text-destructive" : isDone ? "text-foreground" : "text-muted-foreground"}>
              {t(`${s}.label`)}
              {isSkippedHere && tAnalyze("skipped")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// A single tracked analysis job: opens its own SSE connection and manages its
// own step/progress/completion state. The parent only needs to know when it's
// "done" (to refresh the recent-analyses list and recompute queue position),
// not every single SSE event.
function ActiveJobCard({
  job,
  position,
  onDone,
  onDismiss,
  onRetry,
}: {
  job: Job;
  position: number; // how many jobs are ahead of it in the queue (hidden once it's actively being analyzed)
  onDone: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("Analyze");
  const tStep = useTranslations("Step");
  const [step, setStep] = useState<JobStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [completed, setCompleted] = useState(false);
  // job.error is always "" here (`job` is the submission-time snapshot,
  // never updated; SSE's "failed" event only carries a generic message —
  // see sse.go's sseFailedMessage). Fetched fresh once the job fails, since
  // stepIndexFromError needs the real error text.
  const [errorDetail, setErrorDetail] = useState(job.error);
  // Same staleness problem as errorDetail above: `job.result` is null here
  // (the object is from submission time, before analysis ran), so whether
  // the AI explanation was skipped has to be fetched fresh once done fires.
  const [explanationSkipped, setExplanationSkipped] = useState(job.result?.explanation_skipped ?? false);
  // Hover area (whole card) and tooltip anchor (just the icon) are different
  // concerns Radix's uncontrolled hover-on-trigger can't express at once —
  // open state is lifted to the card's onMouseEnter/Leave while
  // TooltipTrigger stays scoped to the icon for positioning.
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const animatedProgress = useAnimatedProgress(step, progress);

  useEffect(() => {
    // Opening one long-lived SSE connection per queued card exhausts the
    // browser's per-origin connection limit once enough songs are queued
    // (6 in Chrome/Firefox), blocking unrelated requests like uploads or
    // navigation — so a card only connects once it's at the front of the
    // queue. `position` ticks down purely from earlier cards' onDone firing.
    if (position > 0) return;

    const source = new EventSource(`/api/progress?job_id=${job.id}`);

    source.addEventListener("pending", () => setStep(null));
    source.addEventListener("processing", (event) => {
      const data: SSEEvent = JSON.parse((event as MessageEvent).data);
      setStep(data.step);
      setProgress(data.progress ?? 0);
    });
    source.addEventListener("done", () => {
      source.close();
      setCompleted(true);
      onDone();
      fetch(`/api/result/${job.id}`)
        .then((res) => res.json())
        .then((body: GatewayEnvelope<Job>) => {
          if (body.code === 20000 && body.data?.result) {
            setExplanationSkipped(body.data.result.explanation_skipped);
          }
        })
        .catch(() => {
          // Best effort — the tooltip just won't show the skipped marker on
          // the explaining step, not worth surfacing a failure over.
        });
    });
    source.addEventListener("failed", () => {
      source.close();
      setFailed(true);
      onDone();
      fetch(`/api/result/${job.id}`)
        .then((res) => res.json())
        .then((body: GatewayEnvelope<Job>) => {
          if (body.code === 20000 && body.data) {
            setErrorDetail(body.data.error);
          }
        })
        .catch(() => {
          // Best effort — the tooltip just falls back to the SSE-derived
          // guess and the error detail line stays hidden, not worth
          // surfacing a second failure on top of the job's own.
        });
    });

    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, position]);

  // Last step SSE reported — still meaningful after completed/failed flips
  // true (neither event resets `step`). "explain_skipped" isn't in
  // STEP_ORDER (a variant of the 4th step, not a 5th), so it maps to the
  // same index; isSkippedStep distinguishes that icon from a normal 4th step.
  const currentIndex =
    step === "explain_skipped" ? STEP_ORDER.indexOf("explaining") : step ? STEP_ORDER.indexOf(step) : -1;
  const isSkippedStep = step === "explain_skipped";

  if (completed) {
    return (
      <div
        className="flex items-center justify-between rounded-2xl border border-border px-6 py-5"
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
            <TooltipTrigger asChild>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="size-3.5 text-primary" strokeWidth={2.5} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              <StepChecklist mode="completed" currentIndex={currentIndex} explanationSkipped={explanationSkipped} />
            </TooltipContent>
          </Tooltip>
          <span className="truncate font-medium text-foreground">{job.title || t("defaultTitle")}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => router.push(`/result/${job.id}`)}>
            {t("viewResult")}
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            {t("viewLater")}
          </Button>
        </div>
      </div>
    );
  }

  if (failed) {
    // Prefer errorDetail's own prefix over the SSE-derived currentIndex —
    // see stepIndexFromError's comment for why the latter can point at the
    // wrong step. Only fall back to currentIndex if the error doesn't match
    // any known prefix (unexpected error shape) or hasn't loaded yet.
    const failedIndex = errorDetail ? stepIndexFromError(errorDetail) : -1;
    const displayIndex = failedIndex !== -1 ? failedIndex : currentIndex;
    return (
      <div
        className="flex items-center justify-between rounded-2xl border border-border px-6 py-5"
        onMouseEnter={() => setTooltipOpen(true)}
        onMouseLeave={() => setTooltipOpen(false)}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
            <TooltipTrigger asChild>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <X className="size-3.5 text-destructive" strokeWidth={2.5} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start">
              <StepChecklist mode="failed" currentIndex={displayIndex} />
            </TooltipContent>
          </Tooltip>
          <span className="truncate font-medium text-foreground">{job.title || t("defaultTitle")}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onRetry}>
            {t("reupload")}
          </Button>
          <Button size="sm" variant="outline" onClick={onDismiss}>
            {t("retryLater")}
          </Button>
        </div>
      </div>
    );
  }

  const isQueued = currentIndex === -1;

  return (
    <div className="rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-base font-medium text-foreground">
          {isQueued ? t("queuedPrefix") : t("analyzingPrefix")}
          {job.title || t("defaultTitle")}
        </p>
        {isQueued && position > 0 && (
          <span className="shrink-0 text-sm text-muted-foreground">{t("queuePosition", { position })}</span>
        )}
      </div>

      {!isQueued && (
        <>
          <div className="mt-4 flex items-center justify-end">
            <span className="text-xs font-medium text-muted-foreground">{Math.round(animatedProgress * 100)}%</span>
          </div>
          <Progress value={animatedProgress * 100} className="mt-1" />

          <ul className="mt-4 space-y-2">
            {STEP_ORDER.map((s, i) => {
              const isSkippedHere = isSkippedStep && currentIndex === i;
              const isDone = !isSkippedHere && currentIndex > i;
              const isCurrent = !isSkippedHere && currentIndex === i;
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  {isSkippedHere ? (
                    <CircleMinus className="size-4 shrink-0 text-muted-foreground" />
                  ) : isDone ? (
                    <Check className="size-4 shrink-0 text-primary" />
                  ) : isCurrent ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Circle className="size-3 shrink-0 text-muted-foreground/40" />
                  )}
                  <div className="group/step relative min-w-0 flex-1">
                    <span
                      className={`block truncate ${isDone || isCurrent ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {tStep(`${s}.label`)}
                      <span className="text-muted-foreground">
                        （{isSkippedHere ? t("explanationSkippedReason") : tStep(`${s}.detail`)}）
                      </span>
                    </span>
                    <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-max max-w-[80vw] rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs whitespace-nowrap text-neutral-900 shadow-lg group-hover/step:block">
                      {tStep(`${s}.label`)}
                      （{isSkippedHere ? t("explanationSkippedReason") : tStep(`${s}.detail`)}）
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export function AnalyzeWorkspace({
  initialRecentJobs,
  initialActiveJobs,
}: {
  initialRecentJobs: Job[];
  initialActiveJobs: Job[];
}) {
  const locale = useLocale();
  const t = useTranslations("Analyze");

  // Submission order = Gateway's FIFO processing order (job.go's NextJob,
  // created_at ASC), so array index is queue position directly. Seeded from
  // lib/gateway.ts's fetchActiveJobs() since activeJobs is plain React
  // state — without it, a refresh would show "nothing running" even though
  // Gateway/Engine are still processing.
  const [activeJobs, setActiveJobs] = useState<Job[]>(initialActiveJobs);
  const [finishedIds, setFinishedIds] = useState<Set<string>>(new Set());
  // Set by the re-upload button on a failed card: the failed row stays put
  // through the file-picker round trip and only disappears once the
  // replacement upload actually starts — not on click, since the user might
  // cancel the picker.
  const [retryJobId, setRetryJobId] = useState<string | null>(null);

  const [demoTracks, setDemoTracks] = useState<DemoTrack[] | null>(null);
  const [loadingDemoList, setLoadingDemoList] = useState(false);
  const [submittingFile, setSubmittingFile] = useState(false);
  const [submittingTrackId, setSubmittingTrackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recentJobs, setRecentJobs] = useState<Job[]>(initialRecentJobs);

  async function refreshRecentJobs() {
    try {
      const res = await fetch("/api/history?status=done&limit=3");
      const body: GatewayEnvelope<ListJobResponse> = await res.json();
      if (body.code === 20000 && body.data) {
        setRecentJobs(body.data.items);
      }
    } catch {
      // A failed history refresh doesn't affect the main flow (the analysis
      // result is already in hand) — fail silently.
    }
  }

  function handleJobDone(jobId: string) {
    setFinishedIds((prev) => new Set(prev).add(jobId));
    refreshRecentJobs();
  }

  function handleDismissJob(jobId: string) {
    setActiveJobs((prev) => prev.filter((j) => j.id !== jobId));
    setFinishedIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  }

  async function submitAudio(file: File) {
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("language", locale);
    const res = await fetch("/api/analyze", { method: "POST", body: formData });
    const body: GatewayEnvelope<Job> = await res.json();
    if (body.code !== 20000 || !body.data) {
      throw new Error(body.message || t("uploadFailed"));
    }
    const newJob = body.data;
    setActiveJobs((prev) => [...prev, newJob]);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setSubmittingFile(true);
    try {
      await submitAudio(file);
      if (retryJobId) {
        handleDismissJob(retryJobId);
        setRetryJobId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadFailed"));
    } finally {
      setSubmittingFile(false);
    }
  }

  function handleRetryJob(jobId: string) {
    setRetryJobId(jobId);
    document.getElementById("audio-file-input")?.click();
  }

  async function handleToggleDemoList() {
    if (demoTracks) {
      setDemoTracks(null);
      return;
    }

    setError(null);
    setLoadingDemoList(true);
    try {
      const res = await fetch("/api/demo-tracks");
      const body: GatewayEnvelope<DemoTracksResponse> = await res.json();
      if (body.code !== 20000 || !body.data) {
        throw new Error(body.message || t("fetchDemoFailed"));
      }
      setDemoTracks(body.data.tracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("fetchDemoFailed"));
    } finally {
      setLoadingDemoList(false);
    }
  }

  async function handleSelectDemoTrack(track: DemoTrack) {
    setError(null);
    setSubmittingTrackId(track.id);
    try {
      const audioRes = await fetch(track.audio_url);
      const blob = await audioRes.blob();
      const file = new File([blob], `${track.title}.mp3`, { type: blob.type || "audio/mpeg" });
      await submitAudio(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("submitDemoFailed"));
    } finally {
      setSubmittingTrackId(null);
    }
  }

  const busy = submittingFile || submittingTrackId !== null;

  return (
    <>
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border px-14 py-8 text-center">
        <Music className="size-9 text-muted-foreground/60" strokeWidth={1.5} />

        <div className="flex flex-col gap-2">
          <p className="text-2xl font-semibold text-foreground">{t("heading")}</p>
          <p className="text-muted-foreground">{t("formatHint")}</p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => document.getElementById("audio-file-input")?.click()}
            disabled={submittingFile}
          >
            {submittingFile && <Loader2 className="size-4 animate-spin" />}
            {t("chooseFile")}
          </Button>
          <Button variant="outline" size="lg" onClick={handleToggleDemoList} disabled={loadingDemoList}>
            {loadingDemoList ? t("loading") : demoTracks ? t("collapseDemos") : t("useDemos")}
          </Button>
          <input
            id="audio-file-input"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={busy}
          />
        </div>

        {demoTracks && demoTracks.length > 0 && (
          <div className="w-full max-w-md space-y-2 text-left">
            {demoTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelectDemoTrack(track)}
                disabled={busy}
                className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <span>
                  <span className="font-medium text-foreground">{track.title}</span>
                  <span className="text-muted-foreground"> — {track.artist}</span>
                </span>
                {submittingTrackId === track.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <span className="shrink-0 text-muted-foreground">{formatDuration(track.duration_sec)}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {activeJobs.length > 0 && (
        <div className="mt-6 space-y-4">
          {activeJobs.map((job, index) => (
            <ActiveJobCard
              key={job.id}
              job={job}
              position={activeJobs.slice(0, index).filter((j) => !finishedIds.has(j.id)).length}
              onDone={() => handleJobDone(job.id)}
              onDismiss={() => handleDismissJob(job.id)}
              onRetry={() => handleRetryJob(job.id)}
            />
          ))}
        </div>
      )}

      <RecentAnalysisList jobs={recentJobs} viewAllHref="/history" />
    </>
  );
}
