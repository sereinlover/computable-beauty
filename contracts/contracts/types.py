"""
Layer-to-layer data contracts for the computable-beauty engine.

Used for Python-internal communication: L1 → L2 → L3 → L4.
numpy arrays stay here and never cross service boundaries.
For cross-service transport, serialize scalars and structured lists only.
"""

from __future__ import annotations
from dataclasses import dataclass
import numpy as np


# ─── Wire-safe scalar summary (crosses service boundary) ──────────────────────

@dataclass
class FeatureSummary:
    bpm: float
    tempo_stability: float  # BPM variance (lower = more stable)
    key: str                # e.g. "D minor", "C major"
    dynamic_range_db: float
    spectral_entropy: float
    silence_ratio: float
    duration_sec: float     # total audio duration


# ─── L1 → L2 ──────────────────────────────────────────────────────────────────

@dataclass
class FeatureBundle:
    audio_id: str
    duration_sec: float
    sample_rate: int  # always 22050

    # Time-series features — stay in engine, never serialized cross-service
    mfcc: np.ndarray               # (40, T)
    mel_spectrogram: np.ndarray    # (128, T)
    chroma: np.ndarray             # (12, T)
    spectral_centroid: np.ndarray  # (T,)
    rms: np.ndarray                # (T,)
    onset_strength: np.ndarray     # (T,)

    # Clip-level scalars — these cross service boundaries
    bpm: float
    tempo_stability: float   # BPM variance (lower = more stable)
    key: str                 # e.g. "D minor", "C major"
    dynamic_range_db: float  # loudest - softest RMS (dB)
    spectral_entropy: float  # mel spectrogram mean entropy
    silence_ratio: float     # fraction of silent frames


# ─── L2 → L3 ──────────────────────────────────────────────────────────────────

@dataclass
class EmotionPoint:
    timestamp_sec: float
    valence: float  # -1.0 ~ 1.0
    arousal: float  # 0.0 ~ 1.0


@dataclass
class Segment:
    start_sec: float
    end_sec: float
    label: str  # "intro" / "verse" / "chorus" / "bridge" / "outro"


@dataclass
class ChordEvent:
    start_sec: float
    end_sec: float
    chord: str  # e.g. "Am", "G7", "Cmaj7"


@dataclass
class GenreEntry:
    label: str
    confidence: float


@dataclass
class InstrumentEntry:
    name: str
    confidence: float


@dataclass
class UnderstandingBundle:
    audio_id: str

    genre: str
    genre_confidence: float
    genre_top3: list[GenreEntry]

    emotion_labels: list[str]        # e.g. ["sad", "intense"]
    valence: float                   # clip-level mean, -1~1
    arousal: float                   # clip-level mean, 0~1
    tension: float                   # harmonic/rhythmic tension, 0~1
    release: float                   # tension resolution ratio, 0~1
    energy: float                    # overall energy level, 0~1
    emotion_arc: list[EmotionPoint]  # frame-level arc

    signature: str  # e.g. "4/4", "3/4"

    instruments: list[InstrumentEntry]

    structure: list[Segment]
    chords: list[ChordEvent]


# ─── L3 → L4 ──────────────────────────────────────────────────────────────────

@dataclass
class DimensionScore:
    score: float                # 0 ~ 100
    evidence: dict[str, float]  # key metrics driving this score


@dataclass
class AestheticBundle:
    """Four independent dimensions, deliberately with no combined score —
    beauty isn't a single scalar, collapsing it into one number hides more
    than it reveals."""

    audio_id: str

    physical_precision: DimensionScore
    structural_logic: DimensionScore
    emotional_depth: DimensionScore
    vital_tension: DimensionScore


# ─── L4 output ────────────────────────────────────────────────────────────────

@dataclass
class ToolCallRecord:
    tool_name: str
    input: dict
    output: dict
    duration_ms: int


@dataclass
class AnalysisResult:
    audio_id: str
    verified: bool  # True if full tool chain completed
    tool_call_count: int
    tool_call_log: list[ToolCallRecord]

    aesthetic: AestheticBundle
    understanding: UnderstandingBundle
    feature_summary: FeatureSummary  # L1 wire-safe scalars, no numpy

    summary: str               # one-sentence conclusion
    explanation: str           # detailed AI interpretation
    explanation_skipped: bool  # True if no OPENAI_API_KEY was configured — summary/explanation are ""
