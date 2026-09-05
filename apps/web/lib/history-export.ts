import ExcelJS from "exceljs";
import type { AestheticBundle, Job } from "@contracts/types";

type DoneJob = Job & { result: NonNullable<Job["result"]> };

const AESTHETIC_DIMENSIONS = ["physical_precision", "structural_logic", "emotional_depth", "vital_tension"] as const;

// feature_summary/understanding are already rounded to 2dp at the engine
// boundary — this only needs to round further where the UI's own display
// goes past that baseline (scores/BPM/durations/timestamps are shown as
// whole numbers, see formatScore/formatDuration in lib/format.ts).
function round0(value: number): number {
  return Math.round(value);
}
// Job.analysis_duration_sec is Gateway-computed (Go), not part of the
// engine's AnalysisResult, so it never goes through the Python-side
// rounding above — formatAnalysisDuration's toFixed(2) is matched here.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Column headers, resolved by the caller (the Route Handler, via
// getTranslations("HistoryExport")) so this file stays free of next-intl —
// same separation as lib/format.ts, which never does i18n lookups itself.
export interface HistoryExportLabels {
  jobId: string;
  title: string;
  artist: string;
  createdAt: string;
  analysisDurationSec: string;
  durationSec: string;
  bpm: string;
  tempoStability: string;
  key: string;
  dynamicRangeDb: string;
  spectralEntropy: string;
  silenceRatio: string;
  signature: string;
  genre: string;
  genreConfidence: string;
  genreTop3: string;
  instruments: string;
  valence: string;
  arousal: string;
  tension: string;
  release: string;
  energy: string;
  emotionLabels: string;
  physicalPrecision: string;
  structuralLogic: string;
  emotionalDepth: string;
  vitalTension: string;
  summary: string;
  explanation: string;
  rank: string;
  genreLabel: string;
  confidence: string;
  instrumentName: string;
  dimension: string;
  score: string;
  evidenceKey: string;
  evidenceValue: string;
  timestampSec: string;
  startSec: string;
  endSec: string;
  segmentLabel: string;
  chord: string;
  toolName: string;
  toolInput: string;
  toolOutput: string;
  durationMs: string;
}

function addOverviewSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Overview");
  sheet.columns = [
    { header: t.jobId, key: "id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.artist, key: "artist", width: 20 },
    { header: t.createdAt, key: "created_at", width: 22 },
    { header: t.analysisDurationSec, key: "analysis_duration_sec", width: 20 },
    { header: t.durationSec, key: "duration_sec", width: 14 },
    { header: t.bpm, key: "bpm", width: 10 },
    { header: t.tempoStability, key: "tempo_stability", width: 18 },
    { header: t.key, key: "key", width: 10 },
    { header: t.dynamicRangeDb, key: "dynamic_range_db", width: 18 },
    { header: t.spectralEntropy, key: "spectral_entropy", width: 16 },
    { header: t.silenceRatio, key: "silence_ratio", width: 14 },
    { header: t.signature, key: "signature", width: 12 },
    { header: t.genre, key: "genre", width: 16 },
    { header: t.genreConfidence, key: "genre_confidence", width: 16 },
    { header: t.genreTop3, key: "genre_top3", width: 36 },
    { header: t.instruments, key: "instruments", width: 48 },
    { header: t.arousal, key: "arousal", width: 10 },
    { header: t.valence, key: "valence", width: 10 },
    { header: t.tension, key: "tension", width: 10 },
    { header: t.release, key: "release", width: 10 },
    { header: t.energy, key: "energy", width: 10 },
    { header: t.emotionLabels, key: "emotion_labels", width: 30 },
    { header: t.physicalPrecision, key: "physical_precision", width: 16 },
    { header: t.structuralLogic, key: "structural_logic", width: 16 },
    { header: t.emotionalDepth, key: "emotional_depth", width: 16 },
    { header: t.vitalTension, key: "vital_tension", width: 14 },
    { header: t.summary, key: "summary", width: 60 },
    { header: t.explanation, key: "explanation", width: 80 },
  ];

  for (const job of jobs) {
    const result = job.result;
    const f = result.feature_summary;
    const u = result.understanding;
    const a = result.aesthetic;
    sheet.addRow({
      id: job.id,
      title: job.title,
      artist: job.artist,
      created_at: job.created_at,
      analysis_duration_sec: job.analysis_duration_sec === null ? null : round2(job.analysis_duration_sec),
      duration_sec: round0(f.duration_sec),
      bpm: round0(f.bpm),
      tempo_stability: f.tempo_stability,
      key: f.key,
      dynamic_range_db: f.dynamic_range_db,
      spectral_entropy: f.spectral_entropy,
      silence_ratio: f.silence_ratio,
      signature: u.signature,
      genre: u.genre,
      genre_confidence: u.genre_confidence,
      genre_top3: u.genre_top3.map((g) => `${g.label} (${g.confidence})`).join(", "),
      // Unlike genre (single-label, softmax top3), instrument tagging is
      // multi-label (independent per-class sigmoid) with no "primary"
      // instrument — one column listing everything above threshold is the
      // whole answer, not a "top1 + top3" split like genre's.
      instruments: u.instruments.map((i) => `${i.name} (${i.confidence})`).join(", "),
      arousal: u.arousal,
      valence: u.valence,
      tension: u.tension,
      release: u.release,
      energy: u.energy,
      emotion_labels: u.emotion_labels.join(", "),
      physical_precision: round0(a.physical_precision.score),
      structural_logic: round0(a.structural_logic.score),
      emotional_depth: round0(a.emotional_depth.score),
      vital_tension: round0(a.vital_tension.score),
      summary: result.summary,
      explanation: result.explanation,
    });
  }
}

function addGenreTop3Sheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Genre Top3");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.rank, key: "rank", width: 8 },
    { header: t.genreLabel, key: "label", width: 20 },
    { header: t.confidence, key: "confidence", width: 14 },
  ];
  for (const job of jobs) {
    job.result.understanding.genre_top3.forEach((entry, i) => {
      sheet.addRow({ job_id: job.id, title: job.title, rank: i + 1, label: entry.label, confidence: entry.confidence });
    });
  }
}

// Not capped at 3 like Genre Top3 — instrument tagging is multi-label with no
// fixed count (see classifiers/instrument.py), so this lists every instrument
// that actually cleared the confidence threshold, however many that is.
function addInstrumentsSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Instruments");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.rank, key: "rank", width: 8 },
    { header: t.instrumentName, key: "name", width: 20 },
    { header: t.confidence, key: "confidence", width: 14 },
  ];
  for (const job of jobs) {
    job.result.understanding.instruments.forEach((entry, i) => {
      sheet.addRow({ job_id: job.id, title: job.title, rank: i + 1, name: entry.name, confidence: entry.confidence });
    });
  }
}

const DIMENSION_LABEL_KEY: Record<(typeof AESTHETIC_DIMENSIONS)[number], keyof HistoryExportLabels> = {
  physical_precision: "physicalPrecision",
  structural_logic: "structuralLogic",
  emotional_depth: "emotionalDepth",
  vital_tension: "vitalTension",
};

function addAestheticEvidenceSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Aesthetic Evidence");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.dimension, key: "dimension", width: 20 },
    { header: t.score, key: "score", width: 10 },
    { header: t.evidenceKey, key: "evidence_key", width: 28 },
    { header: t.evidenceValue, key: "evidence_value", width: 16 },
  ];
  for (const job of jobs) {
    for (const dimension of AESTHETIC_DIMENSIONS) {
      const bundle: AestheticBundle = job.result.aesthetic;
      const dimensionScore = bundle[dimension];
      for (const [evidenceKey, evidenceValue] of Object.entries(dimensionScore.evidence)) {
        sheet.addRow({
          job_id: job.id,
          title: job.title,
          dimension: t[DIMENSION_LABEL_KEY[dimension]],
          score: round0(dimensionScore.score),
          evidence_key: evidenceKey,
          // Left unrounded — scoring/_util.py's dimension_score() already
          // rounds this to 2dp before it crosses the wire, and the product's
          // own evidence table (AestheticDetail) renders it as-is with no
          // further formatting, so matching that means doing nothing here.
          evidence_value: evidenceValue,
        });
      }
    }
  }
}

function addEmotionArcSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Emotion Arc");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.timestampSec, key: "timestamp_sec", width: 16 },
    { header: t.arousal, key: "arousal", width: 10 },
    { header: t.valence, key: "valence", width: 10 },
  ];
  for (const job of jobs) {
    for (const point of job.result.understanding.emotion_arc) {
      sheet.addRow({
        job_id: job.id,
        title: job.title,
        timestamp_sec: round0(point.timestamp_sec),
        arousal: point.arousal,
        valence: point.valence,
      });
    }
  }
}

function addStructureSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Structure Segments");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.startSec, key: "start_sec", width: 16 },
    { header: t.endSec, key: "end_sec", width: 16 },
    { header: t.segmentLabel, key: "label", width: 14 },
  ];
  for (const job of jobs) {
    for (const segment of job.result.understanding.structure) {
      sheet.addRow({
        job_id: job.id,
        title: job.title,
        start_sec: round0(segment.start_sec),
        end_sec: round0(segment.end_sec),
        label: segment.label,
      });
    }
  }
}

function addChordsSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Chords");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.startSec, key: "start_sec", width: 16 },
    { header: t.endSec, key: "end_sec", width: 16 },
    { header: t.chord, key: "chord", width: 10 },
  ];
  for (const job of jobs) {
    for (const chord of job.result.understanding.chords) {
      sheet.addRow({
        job_id: job.id,
        title: job.title,
        start_sec: round0(chord.start_sec),
        end_sec: round0(chord.end_sec),
        chord: chord.chord,
      });
    }
  }
}

function addToolCallLogSheet(workbook: ExcelJS.Workbook, jobs: DoneJob[], t: HistoryExportLabels) {
  const sheet = workbook.addWorksheet("Tool Call Log");
  sheet.columns = [
    { header: t.jobId, key: "job_id", width: 36 },
    { header: t.title, key: "title", width: 24 },
    { header: t.toolName, key: "tool_name", width: 24 },
    { header: t.toolInput, key: "input", width: 50 },
    { header: t.toolOutput, key: "output", width: 50 },
    { header: t.durationMs, key: "duration_ms", width: 14 },
  ];
  for (const job of jobs) {
    for (const call of job.result.tool_call_log) {
      sheet.addRow({
        job_id: job.id,
        title: job.title,
        tool_name: call.tool_name,
        input: JSON.stringify(call.input),
        output: JSON.stringify(call.output),
        duration_ms: call.duration_ms,
      });
    }
  }
}

// One row per song on "Overview" plus one sheet per nested array field
// (genre_top3, instruments, per-dimension evidence, emotion_arc, structure,
// chords, tool_call_log) — a single flat sheet can't hold a variable-length
// list per song, so every AnalysisResult field that isn't a scalar gets its
// own sheet instead of being silently dropped.
export async function buildHistoryWorkbook(jobs: Job[], labels: HistoryExportLabels): Promise<ExcelJS.Buffer> {
  const doneJobs = jobs.filter((j): j is DoneJob => j.result !== null);

  const workbook = new ExcelJS.Workbook();
  addOverviewSheet(workbook, doneJobs, labels);
  addGenreTop3Sheet(workbook, doneJobs, labels);
  addInstrumentsSheet(workbook, doneJobs, labels);
  addAestheticEvidenceSheet(workbook, doneJobs, labels);
  addEmotionArcSheet(workbook, doneJobs, labels);
  addStructureSheet(workbook, doneJobs, labels);
  addChordsSheet(workbook, doneJobs, labels);
  addToolCallLogSheet(workbook, doneJobs, labels);

  return workbook.xlsx.writeBuffer();
}
