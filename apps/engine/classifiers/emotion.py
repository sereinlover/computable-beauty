import argparse
from pathlib import Path

import essentia
import essentia.standard as es
import numpy as np
import soundfile as sf
from contracts.types import EmotionPoint

from classifiers._backbones import get_msd_musicnn_model
from features.audio import MAX_DURATION_SEC

# Suppresses a verbose per-batch warning from TensorflowPredict*.
essentia.log.warningActive = False

MODELS_DIR = Path(__file__).parent / "models"
HEAD_MODEL_PATH = MODELS_DIR / "deam-msd-musicnn-2.pb"
SAMPLE_RATE = 16000

# DEAM annotates both dimensions on a 1-9 scale; the contract wants -1~1/0~1.
DEAM_SCALE_MIN = 1.0
DEAM_SCALE_MAX = 9.0

# msd-musicnn processes audio in patches (patchHopSize=93 mel frames, mel hop
# length 256 samples @ 16kHz) — same patches classify_emotion averages over,
# reused here as emotion_arc's time axis instead of a separate windowing pass.
PATCH_HOP_MEL_FRAMES = 93
MEL_HOP_LENGTH = 256
PATCH_HOP_SEC = PATCH_HOP_MEL_FRAMES * MEL_HOP_LENGTH / SAMPLE_RATE

# Quadrant names follow Thayer's mood model (music-specific), softened for
# display — Thayer's own names ("Anxious/Frantic", "Depression") read as
# clinical diagnoses, not descriptions of a piece of music.
QUADRANT_LABELS = {
    (True, True): ["excited", "joyful"],
    (True, False): ["calm", "peaceful"],
    (False, True): ["tense", "anxious"],
    (False, False): ["wistful", "melancholic"],
}

_head_model: es.TensorflowPredict2D | None = None


def _load_models() -> tuple[es.TensorflowPredictMusiCNN, es.TensorflowPredict2D]:
    """Lazy singleton for the head — the embedding backbone is shared across
    classifiers, see _backbones.py."""
    global _head_model
    if _head_model is None:
        _head_model = es.TensorflowPredict2D(graphFilename=str(HEAD_MODEL_PATH), output="model/Identity")
    return get_msd_musicnn_model(), _head_model


def _rescale(value: float, target_min: float, target_max: float) -> float:
    fraction = (value - DEAM_SCALE_MIN) / (DEAM_SCALE_MAX - DEAM_SCALE_MIN)
    return target_min + fraction * (target_max - target_min)


def emotion_labels(valence: float, arousal: float) -> list[str]:
    """Maps a (valence, arousal) pair in contract range to a quadrant of Russell's circumplex model."""
    return QUADRANT_LABELS[(valence >= 0, arousal >= 0.5)]


def _predict_patches(path: str) -> np.ndarray:
    """Shared embedding+head pipeline — classify_emotion averages the
    resulting per-patch predictions, model_emotion_arc keeps them as a
    time series. Raw values are on DEAM's 1-9 scale, not yet rescaled."""
    if sf.info(path).duration > MAX_DURATION_SEC:
        raise ValueError(f"audio duration exceeds the {MAX_DURATION_SEC}s limit")

    embedding_model, head_model = _load_models()
    audio = es.MonoLoader(filename=path, sampleRate=SAMPLE_RATE, resampleQuality=4)()
    return head_model(embedding_model(audio))


def _points_from_predictions(predictions: np.ndarray) -> list[EmotionPoint]:
    return [
        EmotionPoint(
            timestamp_sec=i * PATCH_HOP_SEC,
            valence=_rescale(float(raw_valence), -1.0, 1.0),
            arousal=_rescale(float(raw_arousal), 0.0, 1.0),
        )
        for i, (raw_valence, raw_arousal) in enumerate(predictions)
    ]


def average_emotion(arc: list[EmotionPoint]) -> tuple[float, float]:
    """Clip-level (valence, arousal) as the arc's mean — exact, not an
    approximation, since rescaling is linear and commutes with averaging."""
    valence = sum(point.valence for point in arc) / len(arc)
    arousal = sum(point.arousal for point in arc) / len(arc)
    return valence, arousal


def classify_emotion(path: str) -> tuple[float, float]:
    """Zero-shot via msd-musicnn embeddings + a DEAM-trained regression head.
    Verified on 767 real PMEmo tracks — r=0.67 (valence), r=0.52 (arousal)."""
    return average_emotion(model_emotion_arc(path))


def model_emotion_arc(path: str) -> list[EmotionPoint]:
    """Per-patch (valence, arousal) time series from the same msd-musicnn
    pipeline classify_emotion averages — no separate sliding-window pass
    needed."""
    return _points_from_predictions(_predict_patches(path))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run emotion (valence/arousal) regression on an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    arc = model_emotion_arc(args.path)
    valence, arousal = average_emotion(arc)
    print(f"valence  {valence:.4f}")
    print(f"arousal  {arousal:.4f}")
    print(f"labels   {emotion_labels(valence, arousal)}")
    print(f"arc      {len(arc)} points, first={arc[0]}, last={arc[-1]}")


if __name__ == "__main__":
    main()
