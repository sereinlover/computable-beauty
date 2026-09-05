"use client";

import { useEffect, useState } from "react";

import type { JobStatus } from "@contracts/types";

// Ceiling each step's fake progress animates toward before the next real SSE
// event arrives and snaps it forward — mirrors apps/gateway/internal/server/
// sse.go's sseStepInfo checkpoints (this step's ceiling = the *next* step's
// base value). explaining/explain_skipped stay below 1 since only the real
// "done" transition should show 100%. Update alongside sse.go if times drift.
const STEP_CEILING: Partial<Record<JobStatus, number>> = {
  pending: 0.05,
  extracting: 0.1,
  classifying: 0.7,
  scoring: 0.8,
  explaining: 0.95,
  explain_skipped: 0.95,
};

// Roughly how long each step takes, in seconds — paces the animation curve
// below, never sent anywhere. explaining is calibrated from three real
// completions (38s/57s/307s); the rest mirror sse.go's own profiling.
const STEP_ESTIMATED_SEC: Partial<Record<JobStatus, number>> = {
  pending: 5,
  extracting: 3,
  classifying: 35,
  scoring: 1,
  explaining: 60,
};

const TICK_MS = 200;

// Interpolates between SSE checkpoints instead of sitting frozen for a
// step's entire real duration (classifying alone runs ~35s with nothing in
// between) — creeps toward the next checkpoint on an exponential-approach
// curve that slows but never quite arrives, so an overrunning step still
// inches forward instead of visibly stalling. The real SSE event, not this
// animation, is what actually advances a step.
export function useAnimatedProgress(step: JobStatus | null, baseProgress: number): number {
  // Snapping `animated` back to baseProgress when either input changes is
  // done directly in the render body (React's own "adjusting state when a
  // prop changes" pattern), not in an effect — Date.now() and the actual
  // tick-driven animation stay confined to the effect below, since neither
  // ref reads nor Date.now() are allowed during render.
  const [prevStep, setPrevStep] = useState(step);
  const [prevBase, setPrevBase] = useState(baseProgress);
  const [animated, setAnimated] = useState(baseProgress);
  if (step !== prevStep || baseProgress !== prevBase) {
    setPrevStep(step);
    setPrevBase(baseProgress);
    setAnimated(baseProgress);
  }

  const ceiling = step ? STEP_CEILING[step] : undefined;
  const estimatedSec = step ? STEP_ESTIMATED_SEC[step] : undefined;

  useEffect(() => {
    if (ceiling === undefined || estimatedSec === undefined) return;

    // tau = half the estimated duration: 1-e^-2 ≈ 86% of the gap covered by
    // the time the step is expected to finish, still approaching (not
    // stalled) if it runs past that.
    const tau = estimatedSec / 2;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - start) / 1000;
      const eased = baseProgress + (ceiling - baseProgress) * (1 - Math.exp(-elapsedSec / tau));
      setAnimated(Math.min(eased, ceiling));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [step, baseProgress, ceiling, estimatedSec]);

  return animated;
}
