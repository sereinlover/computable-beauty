from dataclasses import replace

from _fixtures import EMPTY_UNDERSTANDING_BUNDLE
from contracts.types import EmotionPoint, UnderstandingBundle

from scoring.emotional_depth import score_emotional_depth


def _with_arc(arc: list[EmotionPoint]) -> UnderstandingBundle:
    return replace(EMPTY_UNDERSTANDING_BUNDLE, emotion_arc=arc)


def test_score_emotional_depth_returns_well_formed_score():
    # -0.1 stays inside the hysteresis band (doesn't cross back below
    # -POLARITY_HYSTERESIS), so only the -0.3 -> 0.2 move counts as a switch.
    arc = [EmotionPoint(timestamp_sec=i, valence=v, arousal=a) for i, (v, a) in enumerate([(-0.3, 0.4), (0.2, 0.6), (-0.1, 0.5)])]
    result = score_emotional_depth(_with_arc(arc))

    assert 0 <= result.score <= 100
    assert result.evidence["valence_delta"] == 0.5
    assert result.evidence["polarity_switches"] == 1


def test_polarity_switches_ignore_noise_that_never_leaves_the_hysteresis_band():
    # Values jitter across zero but never move far from it — this is what
    # model prediction noise near a neutral baseline looks like, not a
    # genuine mood swing. None of these small crossings should count.
    noisy_arc = [
        EmotionPoint(timestamp_sec=i, valence=v, arousal=0.5) for i, v in enumerate([-0.05, 0.03, -0.02, 0.06, -0.04, 0.02, -0.03])
    ]
    confident_swing_arc = [EmotionPoint(timestamp_sec=i, valence=v, arousal=0.5) for i, v in enumerate([-0.3, -0.28, 0.3, 0.32, -0.31])]

    noisy_result = score_emotional_depth(_with_arc(noisy_arc))
    swing_result = score_emotional_depth(_with_arc(confident_swing_arc))

    assert noisy_result.evidence["polarity_switches"] == 0
    assert swing_result.evidence["polarity_switches"] == 2


def test_polarity_switch_rate_is_duration_invariant():
    # Same switch density (alternates every point), one arc 10x longer than
    # the other — a raw switch-count formula would score the long one far
    # higher despite identical volatility; the rate should score them the same.
    short_arc = [EmotionPoint(timestamp_sec=i, valence=0.5 if i % 2 == 0 else -0.5, arousal=0.5) for i in range(12)]
    long_arc = [EmotionPoint(timestamp_sec=i, valence=0.5 if i % 2 == 0 else -0.5, arousal=0.5) for i in range(120)]

    short_result = score_emotional_depth(_with_arc(short_arc))
    long_result = score_emotional_depth(_with_arc(long_arc))

    assert short_result.evidence["polarity_switch_rate"] == long_result.evidence["polarity_switch_rate"]
    assert short_result.score == long_result.score


def test_single_point_arc_does_not_crash():
    arc = [EmotionPoint(timestamp_sec=0, valence=0.1, arousal=0.5)]
    result = score_emotional_depth(_with_arc(arc))

    assert result.evidence["polarity_switches"] == 0
    assert result.evidence["polarity_switch_rate"] == 0.0
