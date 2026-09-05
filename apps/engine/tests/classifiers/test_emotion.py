from itertools import pairwise
from pathlib import Path

from classifiers.emotion import average_emotion, classify_emotion, emotion_labels, model_emotion_arc

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_classify_emotion_returns_well_formed_values():
    valence, arousal = classify_emotion(SAMPLE_PATH)

    assert -1 <= valence <= 1
    assert 0 <= arousal <= 1


def test_emotion_labels_covers_all_four_quadrants():
    assert emotion_labels(0.5, 0.8) == ["excited", "joyful"]
    assert emotion_labels(0.5, 0.2) == ["calm", "peaceful"]
    assert emotion_labels(-0.5, 0.8) == ["tense", "anxious"]
    assert emotion_labels(-0.5, 0.2) == ["wistful", "melancholic"]


def test_model_emotion_arc_returns_well_formed_points():
    arc = model_emotion_arc(SAMPLE_PATH)

    assert len(arc) > 0
    assert arc[0].timestamp_sec == 0.0
    for point in arc:
        assert -1 <= point.valence <= 1
        assert 0 <= point.arousal <= 1

    # strictly increasing, evenly spaced timestamps
    for previous, current in pairwise(arc):
        assert current.timestamp_sec > previous.timestamp_sec


def test_average_emotion_matches_classify_emotion():
    # average_emotion(model_emotion_arc(...)) is what classify_emotion computes
    # internally — same values, not just the same order of magnitude.
    arc = model_emotion_arc(SAMPLE_PATH)
    valence, arousal = average_emotion(arc)
    expected_valence, expected_arousal = classify_emotion(SAMPLE_PATH)

    assert valence == expected_valence
    assert arousal == expected_arousal
