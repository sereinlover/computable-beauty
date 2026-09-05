import copy
from dataclasses import replace
from pathlib import Path

import numpy as np
from _fixtures import EMPTY_UNDERSTANDING_BUNDLE
from contracts.types import Segment

from features.aggregator import extract_feature_bundle
from features.dynamic import HOP_LENGTH
from scoring.vital_tension import score_vital_tension

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_score_vital_tension_returns_well_formed_score():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    ub = replace(
        EMPTY_UNDERSTANDING_BUNDLE,
        structure=[
            Segment(start_sec=0, end_sec=fb.duration_sec / 2, label="a"),
            Segment(start_sec=fb.duration_sec / 2, end_sec=fb.duration_sec, label="b"),
        ],
    )
    result = score_vital_tension(fb, ub)

    assert 0 <= result.score <= 100
    assert result.evidence["dynamic_contrast"] >= 0
    assert result.evidence["burst_density"] >= 0


def test_dynamic_contrast_rewards_a_real_quiet_to_loud_journey_over_uniform_loudness():
    # Global rms.max()-rms.min() can't tell a genuine structural build apart
    # from dense production that's simply loud everywhere. Measuring the
    # swing between each segment's own mean loudness instead should score a
    # real journey higher than a uniformly loud track, even if the uniform
    # one has just as much (or more) frame-to-frame jitter.
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    n_frames = len(fb.rms)
    segment_boundary_sec = (n_frames // 2) * HOP_LENGTH / fb.sample_rate

    journey_fb = copy.copy(fb)
    journey_fb.rms = np.concatenate([np.full(n_frames // 2, 0.05), np.full(n_frames - n_frames // 2, 0.4)])

    uniformly_loud_fb = copy.copy(fb)
    # Same overall min/max as the journey track, but jittering frame-to-frame
    # instead of following the segment structure — no real quiet section.
    rng = np.random.default_rng(0)
    uniformly_loud_fb.rms = rng.uniform(0.05, 0.4, size=n_frames)

    ub = replace(
        EMPTY_UNDERSTANDING_BUNDLE,
        structure=[
            Segment(start_sec=0, end_sec=segment_boundary_sec, label="a"),
            Segment(start_sec=segment_boundary_sec, end_sec=fb.duration_sec, label="b"),
        ],
    )

    journey_result = score_vital_tension(journey_fb, ub)
    uniform_result = score_vital_tension(uniformly_loud_fb, ub)

    assert journey_result.evidence["dynamic_contrast"] > uniform_result.evidence["dynamic_contrast"]


def test_dynamic_contrast_is_zero_with_fewer_than_two_segments():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    ub = replace(EMPTY_UNDERSTANDING_BUNDLE, structure=[])
    result = score_vital_tension(fb, ub)

    assert result.evidence["dynamic_contrast"] == 0.0


def test_burst_density_is_relative_to_each_track_own_onset_range():
    # A fixed absolute prominence threshold would treat a quiet track's small
    # fluctuations as real peaks — scaling onset_strength up should not change
    # burst_density if the threshold correctly scales with it.
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    loud_fb = copy.copy(fb)
    loud_fb.onset_strength = fb.onset_strength * 10

    quiet_result = score_vital_tension(fb, EMPTY_UNDERSTANDING_BUNDLE)
    loud_result = score_vital_tension(loud_fb, EMPTY_UNDERSTANDING_BUNDLE)

    assert quiet_result.evidence["burst_density"] == loud_result.evidence["burst_density"]


def test_burst_density_is_not_suppressed_by_a_single_outlier_spike():
    # A max-min-range-relative prominence threshold lets one huge, isolated
    # spike stretch the whole reference range, raising the bar high enough
    # to wipe out every other genuine burst. mean+std isn't swayed by one
    # sample the same way a max-min range is.
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    n_frames = 3000
    baseline_with_bursts = np.full(n_frames, 1.0)
    baseline_with_bursts[::20] = 3.0  # a burst every 20 frames

    normal_fb = copy.copy(fb)
    normal_fb.onset_strength = baseline_with_bursts.copy()

    with_outlier = baseline_with_bursts.copy()
    with_outlier[n_frames // 2] = 100.0  # one extreme, isolated spike

    outlier_fb = copy.copy(fb)
    outlier_fb.onset_strength = with_outlier

    normal_result = score_vital_tension(normal_fb, EMPTY_UNDERSTANDING_BUNDLE)
    outlier_result = score_vital_tension(outlier_fb, EMPTY_UNDERSTANDING_BUNDLE)

    assert outlier_result.evidence["burst_density"] == normal_result.evidence["burst_density"]
