import copy
from pathlib import Path

from features.aggregator import extract_feature_bundle
from scoring.physical_precision import score_physical_precision

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_score_physical_precision_returns_well_formed_score():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    result = score_physical_precision(fb)

    assert 0 <= result.score <= 100
    assert result.evidence["tempo_stability"] == round(fb.tempo_stability, 2)
    assert result.evidence["dynamic_range_db"] == round(fb.dynamic_range_db, 2)
    assert result.evidence["frequency_balance_std_db"] >= 0


def test_score_physical_precision_rewards_stable_tempo():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    stable = score_physical_precision(fb)

    # Shallow copy is enough since only a scalar field changes below — the
    # numpy array fields stay shared, unmodified.
    unstable_fb = copy.copy(fb)
    unstable_fb.tempo_stability = fb.tempo_stability + 0.2
    unstable = score_physical_precision(unstable_fb)

    assert unstable.score < stable.score
