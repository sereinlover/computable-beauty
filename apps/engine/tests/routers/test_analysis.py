from dataclasses import asdict
from pathlib import Path

from contracts.types import FeatureSummary, UnderstandingBundle

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
from routers.analysis import ClassifyRequest, ScoreAestheticsRequest, classify, score_aesthetics

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def _understanding_bundle(path: str) -> UnderstandingBundle:
    """Builds an UnderstandingBundle the same way /internal/classify does, to
    feed into score_aesthetics (which takes one as input, doesn't call classify() itself)."""
    genre, genre_confidence, genre_top3 = classify_genre(path)
    emotion_arc = model_emotion_arc(path)
    valence, arousal = average_emotion(emotion_arc)
    return UnderstandingBundle(
        audio_id="test-audio-id",
        genre=genre,
        genre_confidence=genre_confidence,
        genre_top3=genre_top3,
        emotion_labels=emotion_labels(valence, arousal),
        valence=valence,
        arousal=arousal,
        tension=compute_tension(path),
        release=compute_release(path),
        energy=compute_energy(extract_feature_bundle("test-audio-id", path)),
        emotion_arc=emotion_arc,
        signature=detect_signature(path),
        instruments=classify_instruments(path),
        structure=segment_structure(path),
        chords=recognize_chords(path),
    )


def test_classify_returns_a_well_formed_bundle():
    payload = ClassifyRequest(audio_id="test-audio-id", audio_path=SAMPLE_PATH, feature_summary={})
    result = classify(payload)

    assert result.audio_id == "test-audio-id"
    assert result.signature in ("3/4", "4/4")
    assert 0 <= result.tension <= 1
    assert 0 <= result.release <= 1
    assert 0 <= result.energy <= 1


def test_score_aesthetics_returns_a_well_formed_bundle():
    feature_summary = build_feature_summary(extract_feature_bundle("test-audio-id", SAMPLE_PATH))
    understanding = _understanding_bundle(SAMPLE_PATH)

    payload = ScoreAestheticsRequest(
        audio_id="test-audio-id",
        audio_path=SAMPLE_PATH,
        feature_summary=FeatureSummary(**asdict(feature_summary)),
        understanding=understanding,
    )
    result = score_aesthetics(payload)

    assert result.audio_id == "test-audio-id"
    for dimension in [result.physical_precision, result.structural_logic, result.emotional_depth, result.vital_tension]:
        assert 0 <= dimension.score <= 100
        assert len(dimension.evidence) > 0
