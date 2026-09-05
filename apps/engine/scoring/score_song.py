import argparse

from contracts.types import UnderstandingBundle

from classifiers.chord import recognize_chords
from classifiers.emotion import average_emotion, emotion_labels, model_emotion_arc
from classifiers.energy import compute_energy
from classifiers.genre import classify_genre
from classifiers.instrument import classify_instruments
from classifiers.release import compute_release
from classifiers.signature import detect_signature
from classifiers.structure import segment_structure
from classifiers.tension import compute_tension
from features.aggregator import extract_feature_bundle
from scoring.emotional_depth import score_emotional_depth
from scoring.physical_precision import score_physical_precision
from scoring.structural_logic import score_structural_logic
from scoring.vital_tension import score_vital_tension


def score_song(path: str) -> None:
    """Runs the same L1-L3 pipeline as /internal/extract-features + /internal/classify + /internal/score-aesthetics, without needing the gateway/Postgres/Redis stack running."""
    fb = extract_feature_bundle(path, path)

    genre, genre_confidence, genre_top3 = classify_genre(path)
    instruments = classify_instruments(path)
    emotion_arc = model_emotion_arc(path)
    valence, arousal = average_emotion(emotion_arc)
    structure = segment_structure(path)
    chords = recognize_chords(path)
    ub = UnderstandingBundle(
        audio_id=path,
        genre=genre,
        genre_confidence=genre_confidence,
        genre_top3=genre_top3,
        emotion_labels=emotion_labels(valence, arousal),
        valence=valence,
        arousal=arousal,
        tension=compute_tension(path),
        release=compute_release(path),
        energy=compute_energy(fb),
        emotion_arc=emotion_arc,
        signature=detect_signature(path),
        instruments=instruments,
        structure=structure,
        chords=chords,
    )

    physical_precision = score_physical_precision(fb)
    emotional_depth = score_emotional_depth(ub)
    vital_tension = score_vital_tension(fb, ub)
    structural_logic = score_structural_logic(fb, ub)

    print(f"genre: {genre} ({genre_confidence:.2f})")
    for name, result in [
        ("physical_precision", physical_precision),
        ("structural_logic", structural_logic),
        ("emotional_depth", emotional_depth),
        ("vital_tension", vital_tension),
    ]:
        print(f"  {name}: {result.score:.1f}  {result.evidence}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the full L1-L3 aesthetic scoring pipeline on a local audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()
    score_song(args.path)


if __name__ == "__main__":
    main()
