import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

import { fetchAllJobs } from "@/lib/gateway";
import { buildHistoryWorkbook, type HistoryExportLabels } from "@/lib/history-export";

export async function GET() {
  const [jobs, t] = await Promise.all([fetchAllJobs(), getTranslations("HistoryExport")]);

  // Every key on HistoryExportLabels, resolved against the request's own
  // locale (same cookie-based resolution as any Server Component's
  // getTranslations) — this is why the export is a Route Handler and not a
  // client-side XLSX build, it needs server-side i18n.
  const labels: HistoryExportLabels = {
    jobId: t("jobId"),
    title: t("title"),
    artist: t("artist"),
    createdAt: t("createdAt"),
    analysisDurationSec: t("analysisDurationSec"),
    durationSec: t("durationSec"),
    bpm: t("bpm"),
    tempoStability: t("tempoStability"),
    key: t("key"),
    dynamicRangeDb: t("dynamicRangeDb"),
    spectralEntropy: t("spectralEntropy"),
    silenceRatio: t("silenceRatio"),
    signature: t("signature"),
    genre: t("genre"),
    genreConfidence: t("genreConfidence"),
    genreTop3: t("genreTop3"),
    instruments: t("instruments"),
    valence: t("valence"),
    arousal: t("arousal"),
    tension: t("tension"),
    release: t("release"),
    energy: t("energy"),
    emotionLabels: t("emotionLabels"),
    physicalPrecision: t("physicalPrecision"),
    structuralLogic: t("structuralLogic"),
    emotionalDepth: t("emotionalDepth"),
    vitalTension: t("vitalTension"),
    summary: t("summary"),
    explanation: t("explanation"),
    rank: t("rank"),
    genreLabel: t("genreLabel"),
    confidence: t("confidence"),
    instrumentName: t("instrumentName"),
    dimension: t("dimension"),
    score: t("score"),
    evidenceKey: t("evidenceKey"),
    evidenceValue: t("evidenceValue"),
    timestampSec: t("timestampSec"),
    startSec: t("startSec"),
    endSec: t("endSec"),
    segmentLabel: t("segmentLabel"),
    chord: t("chord"),
    toolName: t("toolName"),
    toolInput: t("toolInput"),
    toolOutput: t("toolOutput"),
    durationMs: t("durationMs"),
  };

  const buffer = await buildHistoryWorkbook(jobs, labels);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="computable-beauty-history.xlsx"',
    },
  });
}
