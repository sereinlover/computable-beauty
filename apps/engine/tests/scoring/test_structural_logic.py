from dataclasses import replace
from pathlib import Path

from _fixtures import EMPTY_UNDERSTANDING_BUNDLE
from contracts.types import ChordEvent, Segment

from features.aggregator import extract_feature_bundle
from scoring.structural_logic import calc_tsd_coverage, score_structural_logic

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_calc_tsd_coverage_recognizes_diatonic_chords_in_g_major():
    # I-V-vi-IV-V-I-...-vi, one non-diatonic chord (F#m) mixed in
    chords = [
        ChordEvent(start_sec=0, end_sec=1, chord="G"),  # I
        ChordEvent(start_sec=1, end_sec=2, chord="D"),  # V
        ChordEvent(start_sec=2, end_sec=3, chord="Em"),  # vi
        ChordEvent(start_sec=3, end_sec=4, chord="C"),  # IV
        ChordEvent(start_sec=4, end_sec=5, chord="F#m"),  # not diatonic in G major
    ]
    assert calc_tsd_coverage(chords, "G major") == 4 / 5


def test_calc_tsd_coverage_handles_flats_and_sharps_the_same():
    chords_sharp = [ChordEvent(start_sec=0, end_sec=1, chord="D#")]
    chords_flat = [ChordEvent(start_sec=0, end_sec=1, chord="Eb")]
    assert calc_tsd_coverage(chords_sharp, "C major") == calc_tsd_coverage(chords_flat, "C major")


def test_calc_tsd_coverage_empty_chords_or_unparseable_key_returns_zero():
    assert calc_tsd_coverage([], "C major") == 0.0
    assert calc_tsd_coverage([ChordEvent(start_sec=0, end_sec=1, chord="C")], "not a key") == 0.0


def test_score_structural_logic_returns_well_formed_score():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    ub = replace(
        EMPTY_UNDERSTANDING_BUNDLE,
        chords=[
            ChordEvent(start_sec=0, end_sec=5, chord="G"),
            ChordEvent(start_sec=5, end_sec=10, chord="D"),
        ],
        structure=[
            Segment(start_sec=0, end_sec=10, label="intro"),
            Segment(start_sec=10, end_sec=20, label="verse"),
        ],
    )
    result = score_structural_logic(fb, ub)

    assert 0 <= result.score <= 100
    assert 0 <= result.evidence["tsd_coverage"] <= 1
    assert result.evidence["segment_balance_ratio"] >= 0


def test_chord_variety_rewards_a_broader_harmonic_vocabulary():
    # A 3-chord loop hitting 100% tsd_coverage with perfectly even segments
    # shouldn't outscore a harmonically richer piece just because the
    # richer piece's extra chords fall outside the tonic/subdominant/
    # dominant template.
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    same_structure = [Segment(start_sec=i * 10, end_sec=(i + 1) * 10, label="s") for i in range(4)]

    narrow_ub = replace(
        EMPTY_UNDERSTANDING_BUNDLE,
        chords=[ChordEvent(start_sec=i, end_sec=i + 1, chord=c) for i, c in enumerate(["C", "F", "G"] * 3)],
        structure=same_structure,
    )
    broad_ub = replace(
        EMPTY_UNDERSTANDING_BUNDLE,
        chords=[ChordEvent(start_sec=i, end_sec=i + 1, chord=c) for i, c in enumerate(["C", "F", "G", "Dm", "Am", "Em", "A", "D", "E"])],
        structure=same_structure,
    )

    narrow_result = score_structural_logic(fb, narrow_ub)
    broad_result = score_structural_logic(fb, broad_ub)

    assert broad_result.evidence["n_distinct_chords"] > narrow_result.evidence["n_distinct_chords"]
    assert broad_result.score > narrow_result.score


def test_score_structural_logic_handles_extremely_uneven_segments():
    # One tiny segment against a run of much longer ones — std exceeds mean
    # here (ratio 1.95), which would make an unclipped balance_score
    # negative; the raw ratio itself is what evidence reports, unbounded
    # above by design, while the final score still clips to [0, 100].
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    ub = replace(
        EMPTY_UNDERSTANDING_BUNDLE,
        chords=[ChordEvent(start_sec=0, end_sec=1, chord="G")],
        structure=[
            Segment(start_sec=0, end_sec=1, label="intro"),
            Segment(start_sec=1, end_sec=2, label="verse"),
            Segment(start_sec=2, end_sec=3, label="verse"),
            Segment(start_sec=3, end_sec=4, label="verse"),
            Segment(start_sec=4, end_sec=200, label="outro"),
        ],
    )
    result = score_structural_logic(fb, ub)

    assert 0 <= result.score <= 100
    assert result.evidence["segment_balance_ratio"] > 1
