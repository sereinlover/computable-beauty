import argparse
import json
from pathlib import Path

import essentia
import essentia.standard as es
import numpy as np
import soundfile as sf
from contracts.types import InstrumentEntry

from classifiers._backbones import get_discogs_effnet_model
from features.audio import MAX_DURATION_SEC

# Suppresses a verbose per-batch warning from TensorflowPredict*.
essentia.log.warningActive = False

MODELS_DIR = Path(__file__).parent / "models"
HEAD_MODEL_PATH = MODELS_DIR / "mtg_jamendo_instrument-discogs-effnet-1.pb"
HEAD_METADATA_PATH = MODELS_DIR / "mtg_jamendo_instrument-discogs-effnet-1.json"
SAMPLE_RATE = 16000

# Whole-track mean pooling dilutes instruments that only play part of a long
# song. Segmenting and taking the max score per instrument across segments
# fixes that; 30s beat 60s in testing.
SEGMENT_DURATION_SEC = 30
# A trailing remainder shorter than this merges into the previous segment —
# too few patches for a stable average.
MIN_SEGMENT_DURATION_SEC = 15

# "voice" measured unreliable, and a dedicated replacement model didn't do
# better either — a wrong tag can get cited as AI-layer evidence.
EXCLUDED_CLASSES = frozenset({"voice"})

# Multi-label sigmoid confidence, independent per instrument. False positives
# cost more than misses here (a wrong tag can get cited as evidence by L4),
# so the threshold favors precision.
CONFIDENCE_THRESHOLD = 0.35

_head_model: es.TensorflowPredict2D | None = None
_classes: list[str] | None = None


def _load_models() -> tuple[es.TensorflowPredictEffnetDiscogs, es.TensorflowPredict2D, list[str]]:
    """Lazy singleton — loading the head's TensorFlow graph is expensive, no reason to redo it per request."""
    global _head_model, _classes
    if _head_model is None:
        _head_model = es.TensorflowPredict2D(
            graphFilename=str(HEAD_MODEL_PATH),
            input="model/Placeholder",
            output="model/Sigmoid",
        )
        _classes = [name for name in json.loads(HEAD_METADATA_PATH.read_text())["classes"] if name not in EXCLUDED_CLASSES]
    return get_discogs_effnet_model(), _head_model, _classes


def _split_into_segments(audio: np.ndarray) -> list[np.ndarray]:
    segment_samples = SEGMENT_DURATION_SEC * SAMPLE_RATE
    min_samples = MIN_SEGMENT_DURATION_SEC * SAMPLE_RATE
    total = len(audio)
    if total <= segment_samples:
        return [audio]

    segments = []
    start = 0
    while start < total:
        end = min(start + segment_samples, total)
        if total - end < min_samples:
            end = total  # absorb a short trailing remainder into this segment
        segments.append(audio[start:end])
        start = end
    return segments


def classify_instruments(path: str) -> list[InstrumentEntry]:
    """Multi-label via discogs-effnet + mtg_jamendo_instrument (40 classes,
    minus EXCLUDED_CLASSES). Processed in SEGMENT_DURATION_SEC chunks, taking
    the max score per instrument across segments. Sorted by confidence, highest first."""
    if sf.info(path).duration > MAX_DURATION_SEC:
        raise ValueError(f"audio duration exceeds the {MAX_DURATION_SEC}s limit")

    embedding_model, head_model, classes = _load_models()

    audio = es.MonoLoader(filename=path, sampleRate=SAMPLE_RATE, resampleQuality=4)()

    max_scores = {name: 0.0 for name in classes}
    for segment in _split_into_segments(audio):
        embeddings = embedding_model(segment)
        predictions = head_model(embeddings).mean(axis=0)
        for name, score in zip(classes, predictions.tolist()):
            max_scores[name] = max(max_scores[name], score)

    ranked = sorted(max_scores.items(), key=lambda pair: -pair[1])
    return [InstrumentEntry(name=name, confidence=confidence) for name, confidence in ranked if confidence >= CONFIDENCE_THRESHOLD]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run instrument classification on an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    for entry in classify_instruments(args.path):
        print(f"{entry.name:<15} {entry.confidence:.4f}")


if __name__ == "__main__":
    main()
