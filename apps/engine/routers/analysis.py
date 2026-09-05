# L1-L3 endpoints — deterministic, no LLM involved.

import concurrent.futures

import soundfile as sf
from contracts.types import (
    AestheticBundle,
    ChordEvent,
    EmotionPoint,
    FeatureSummary,
    GenreEntry,
    InstrumentEntry,
    Segment,
    UnderstandingBundle,
)
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import verify_internal_token
from classifiers.chord import recognize_chords
from classifiers.emotion import average_emotion, emotion_labels, model_emotion_arc
from classifiers.energy import compute_energy
from classifiers.genre import classify_genre
from classifiers.instrument import classify_instruments
from classifiers.release import compute_release
from classifiers.signature import detect_signature
from classifiers.structure import segment_structure
from classifiers.tension import compute_tension
from features.aggregator import build_feature_summary, extract_feature_bundle
from scoring.emotional_depth import score_emotional_depth
from scoring.physical_precision import score_physical_precision
from scoring.structural_logic import score_structural_logic
from scoring.vital_tension import score_vital_tension

router = APIRouter(dependencies=[Depends(verify_internal_token)])

# classify()'s 9 concurrent tasks each decode the full track into memory —
# fine at normal song length, but a long track (e.g. a ~30min recording)
# makes even 3-way concurrency multiply an already-large per-task footprint
# enough to risk OOM. Past this length, drop to fully serial instead.
LONG_TRACK_THRESHOLD_SEC = 600
LONG_TRACK_MAX_WORKERS = 1
DEFAULT_MAX_WORKERS = 3


class ExtractFeaturesRequest(BaseModel):
    audio_id: str
    audio_path: str


class ClassifyRequest(BaseModel):
    audio_id: str
    audio_path: str
    feature_summary: dict


class ScoreAestheticsRequest(BaseModel):
    audio_id: str
    audio_path: str
    feature_summary: FeatureSummary
    understanding: UnderstandingBundle


@router.post("/internal/extract-features", response_model=FeatureSummary)
def extract_features(payload: ExtractFeaturesRequest) -> FeatureSummary:
    bundle = extract_feature_bundle(payload.audio_id, payload.audio_path)
    return build_feature_summary(bundle)


@router.post("/internal/classify", response_model=UnderstandingBundle)
def classify(payload: ClassifyRequest) -> UnderstandingBundle:
    # Each task independently decodes its own audio and runs its own model.
    # max_workers is capped below the 9 tasks submitted — running all 9 at
    # once multiplies peak memory per request nearly 9x.
    duration_sec = sf.info(payload.audio_path).duration
    max_workers = LONG_TRACK_MAX_WORKERS if duration_sec > LONG_TRACK_THRESHOLD_SEC else DEFAULT_MAX_WORKERS
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        fb_future = pool.submit(extract_feature_bundle, payload.audio_id, payload.audio_path)
        genre_future = pool.submit(classify_genre, payload.audio_path)
        instruments_future = pool.submit(classify_instruments, payload.audio_path)
        emotion_arc_future = pool.submit(model_emotion_arc, payload.audio_path)
        structure_future = pool.submit(segment_structure, payload.audio_path)
        chords_future = pool.submit(recognize_chords, payload.audio_path)
        signature_future = pool.submit(detect_signature, payload.audio_path)
        tension_future = pool.submit(compute_tension, payload.audio_path)
        release_future = pool.submit(compute_release, payload.audio_path)

        fb = fb_future.result()
        genre, genre_confidence, genre_top3 = genre_future.result()
        instruments = instruments_future.result()
        emotion_arc = emotion_arc_future.result()
        structure = structure_future.result()
        chords = chords_future.result()
        signature = signature_future.result()
        tension = tension_future.result()
        release = release_future.result()

    valence, arousal = average_emotion(emotion_arc)
    energy = compute_energy(fb)  # reuses fb's already-computed rms, no extra decode

    # Rounded to 2 decimals for the same reason as FeatureSummary and
    # scoring/_util.py's dimension_score() — this whole struct is also dumped
    # into the LLM's context (harness/orchestrator.py).
    return UnderstandingBundle(
        audio_id=payload.audio_id,
        genre=genre,
        genre_confidence=round(genre_confidence, 2),
        genre_top3=[GenreEntry(label=g.label, confidence=round(g.confidence, 2)) for g in genre_top3],
        emotion_labels=emotion_labels(valence, arousal),
        valence=round(valence, 2),
        arousal=round(arousal, 2),
        tension=round(tension, 2),
        release=round(release, 2),
        energy=round(energy, 2),
        emotion_arc=[
            EmotionPoint(timestamp_sec=round(p.timestamp_sec, 2), valence=round(p.valence, 2), arousal=round(p.arousal, 2))
            for p in emotion_arc
        ],
        signature=signature,
        instruments=[InstrumentEntry(name=i.name, confidence=round(i.confidence, 2)) for i in instruments],
        structure=[Segment(start_sec=round(s.start_sec, 2), end_sec=round(s.end_sec, 2), label=s.label) for s in structure],
        chords=[ChordEvent(start_sec=round(c.start_sec, 2), end_sec=round(c.end_sec, 2), chord=c.chord) for c in chords],
    )


@router.post("/internal/score-aesthetics", response_model=AestheticBundle)
def score_aesthetics(payload: ScoreAestheticsRequest) -> AestheticBundle:
    # FeatureBundle's time-series arrays never cross the service boundary (see
    # contracts/contracts/types.py), so payload.feature_summary can't carry them —
    # re-extracted here from audio_path instead, same pattern L2's classifiers use.
    fb = extract_feature_bundle(payload.audio_id, payload.audio_path)
    ub = payload.understanding

    physical_precision = score_physical_precision(fb)
    structural_logic = score_structural_logic(fb, ub)
    emotional_depth = score_emotional_depth(ub)
    vital_tension = score_vital_tension(fb, ub)

    return AestheticBundle(
        audio_id=payload.audio_id,
        physical_precision=physical_precision,
        structural_logic=structural_logic,
        emotional_depth=emotional_depth,
        vital_tension=vital_tension,
    )
