"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Circle, CircleMinus, Loader2 } from "lucide-react";

import type { Job, JobStatus, SSEEvent } from "@contracts/types";
import { Progress } from "@/components/ui/progress";

// Same four steps and order as apps/gateway/internal/server/sse.go's
// sseStepInfo — Gateway's own step messages are English, apps/web owns the
// translated labels via messages/*.json's "Step" namespace (shared with
// analyze-workspace.tsx).
const STEP_ORDER: JobStatus[] = ["extracting", "classifying", "scoring", "explaining"];

export function ProcessingView({ job }: { job: Job }) {
  const router = useRouter();
  const t = useTranslations("Result");
  const tAnalyze = useTranslations("Analyze");
  const tStep = useTranslations("Step");
  const [step, setStep] = useState<JobStatus | null>(
    STEP_ORDER.includes(job.status) ? job.status : null
  );
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(job.status === "failed");
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (job.status === "done" || job.status === "failed") return;

    const source = new EventSource(`/api/progress?job_id=${job.id}`);

    source.addEventListener("pending", () => setStep(null));
    source.addEventListener("processing", (event) => {
      const data: SSEEvent = JSON.parse((event as MessageEvent).data);
      setStep(data.step);
      setProgress(data.progress ?? 0);
    });
    source.addEventListener("done", () => {
      source.close();
      router.refresh();
    });
    source.addEventListener("failed", () => {
      source.close();
      setFailed(true);
    });
    source.addEventListener("timeout", () => {
      source.close();
      setTimedOut(true);
    });

    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.status, retryKey]);

  if (failed) {
    return (
      <div className="rounded-2xl border border-border p-10 text-center">
        <p className="text-lg font-medium text-foreground">{t("analysisFailed")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{job.error || t("retryUploadHint")}</p>
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="rounded-2xl border border-border p-10 text-center">
        <p className="text-lg font-medium text-foreground">{t("stillQueued")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("connectionLost")}</p>
        <button
          className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
          onClick={() => {
            setTimedOut(false);
            setRetryKey((k) => k + 1);
          }}
        >
          {t("reconnect")}
        </button>
      </div>
    );
  }

  // "explain_skipped" (no OPENAI_API_KEY — see gateway pipeline.go) isn't
  // in STEP_ORDER, it's a variant of the 4th step, not a 5th one — maps to
  // the same index "explaining" would, isSkippedStep tells the icon apart.
  const currentIndex =
    step === "explain_skipped" ? STEP_ORDER.indexOf("explaining") : step ? STEP_ORDER.indexOf(step) : -1;
  const isSkippedStep = step === "explain_skipped";

  return (
    <div className="rounded-2xl border border-border p-10">
      <p className="text-lg font-medium text-foreground">
        {t("analyzingTrack", { title: job.title || tAnalyze("defaultTitle") })}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {currentIndex === -1 ? t("queuedWaiting") : t("uploadedWaitEstimate")}
      </p>

      <Progress value={progress * 100} className="mt-6" />

      <ul className="mt-6 space-y-3 text-left">
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
              <span className={isDone || isCurrent ? "text-foreground" : "text-muted-foreground"}>
                {tStep(`${s}.label`)}
                {isSkippedHere && tAnalyze("skipped")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
