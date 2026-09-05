import argparse
import json
from pathlib import Path

import essentia
import essentia.standard as es
import soundfile as sf
from contracts.types import GenreEntry

from classifiers._backbones import get_discogs_effnet_model
from features.audio import MAX_DURATION_SEC

# Suppresses a verbose per-batch warning from TensorflowPredict*.
essentia.log.warningActive = False

MODELS_DIR = Path(__file__).parent / "models"
HEAD_MODEL_PATH = MODELS_DIR / "genre_discogs400-discogs-effnet-1.pb"
HEAD_METADATA_PATH = MODELS_DIR / "genre_discogs400-discogs-effnet-1.json"
SAMPLE_RATE = 16000

_head_model: es.TensorflowPredict2D | None = None
_top_levels: list[str] | None = None


def _load_models() -> tuple[es.TensorflowPredictEffnetDiscogs, es.TensorflowPredict2D, list[str]]:
    """Lazy singleton — loading the head's TensorFlow graph is expensive, no reason to redo it per request."""
    global _head_model, _top_levels
    if _head_model is None:
        _head_model = es.TensorflowPredict2D(
            graphFilename=str(HEAD_MODEL_PATH),
            input="serving_default_model_Placeholder",
            output="PartitionedCall:0",
        )
        classes = json.loads(HEAD_METADATA_PATH.read_text())["classes"]
        # Discogs labels are "TopLevelGenre---SubStyle" — split gives the taxonomy's own top-level genres.
        _top_levels = [name.split("---")[0] for name in classes]
    return get_discogs_effnet_model(), _head_model, _top_levels


def classify_genre(path: str) -> tuple[str, float, list[GenreEntry]]:
    """Zero-shot via discogs-effnet + genre_discogs400. The 400 fine-grained
    styles are grouped into 15 top-level genres (max score per group, normalized)."""
    if sf.info(path).duration > MAX_DURATION_SEC:
        raise ValueError(f"audio duration exceeds the {MAX_DURATION_SEC}s limit")

    embedding_model, head_model, top_levels = _load_models()

    audio = es.MonoLoader(filename=path, sampleRate=SAMPLE_RATE, resampleQuality=4)()
    embeddings = embedding_model(audio)
    predictions = head_model(embeddings)
    mean_scores = predictions.mean(axis=0)

    bucket_scores: dict[str, float] = {}
    for group, score in zip(top_levels, mean_scores.tolist()):
        bucket_scores[group] = max(bucket_scores.get(group, 0.0), score)

    total = sum(bucket_scores.values())
    ranked = sorted(bucket_scores.items(), key=lambda pair: -pair[1])
    top3 = [GenreEntry(label=name, confidence=score / total) for name, score in ranked[:3]]
    return top3[0].label, top3[0].confidence, top3


def main() -> None:
    parser = argparse.ArgumentParser(description="Run genre classification on an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    _genre, _confidence, top3 = classify_genre(args.path)
    for entry in top3:
        print(f"{entry.label:<25} {entry.confidence:.4f}")


if __name__ == "__main__":
    main()
