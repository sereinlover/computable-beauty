import numpy as np
from contracts.types import DimensionScore, UnderstandingBundle

from scoring._util import dimension_score, normalize

# Real music never reaches the contract's theoretical range (valence -1~1,
# arousal 0~1) — calibrated off the most dramatic real track measured
# instead.
VALENCE_DELTA_MAX = 1.0
AROUSAL_STD_MAX = 0.15

# Hysteresis band (Schmitt-trigger style) so a switch only counts once the
# arc crosses from clearly negative to clearly positive or back — a bare
# sign flip would count model-noise jitter near zero as a mood swing. Sized
# to 2x the frame-to-frame noise measured on a genuinely flat real track.
POLARITY_HYSTERESIS = 0.12

# A rate, not a raw count — a raw count scales with track duration (more arc
# points to switch between), not real volatility. Calibrated off the most
# volatile real track measured.
POLARITY_SWITCH_RATE_REFERENCE = 0.025

WEIGHTS = {"valence_delta": 0.4, "arousal_std": 0.3, "polarity_switch_rate": 0.3}


def _count_polarity_switches(valence: list[float]) -> int:
    """Counts hysteresis-band crossings — see POLARITY_HYSTERESIS."""
    state = None
    switches = 0
    for v in valence:
        if v > POLARITY_HYSTERESIS:
            if state == "neg":
                switches += 1
            state = "pos"
        elif v < -POLARITY_HYSTERESIS:
            if state == "pos":
                switches += 1
            state = "neg"
    return switches


def score_emotional_depth(ub: UnderstandingBundle) -> DimensionScore:
    """Valence range + arousal variance + polarity-switch rate, weighted per WEIGHTS."""
    valence = [p.valence for p in ub.emotion_arc]
    arousal = [p.arousal for p in ub.emotion_arc]

    valence_delta = max(valence) - min(valence)
    arousal_std = float(np.std(arousal))
    polarity_switches = _count_polarity_switches(valence)
    polarity_switch_rate = polarity_switches / (len(valence) - 1) if len(valence) > 1 else 0.0

    valence_score = normalize(valence_delta, VALENCE_DELTA_MAX)
    arousal_score = normalize(arousal_std, AROUSAL_STD_MAX)
    polarity_score = normalize(polarity_switch_rate, POLARITY_SWITCH_RATE_REFERENCE)

    score = (
        valence_score * WEIGHTS["valence_delta"] + arousal_score * WEIGHTS["arousal_std"] + polarity_score * WEIGHTS["polarity_switch_rate"]
    ) * 100
    return dimension_score(
        score=score,
        evidence={
            "valence_delta": valence_delta,
            "arousal_std": arousal_std,
            "polarity_switches": polarity_switches,
            "polarity_switch_rate": polarity_switch_rate,
        },
    )
