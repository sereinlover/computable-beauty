import numpy as np
from contracts.types import DimensionScore, FeatureBundle, UnderstandingBundle

from features.dynamic import BURST_DENSITY_REFERENCE_PER_MIN, HOP_LENGTH, onset_burst_density
from scoring._util import dimension_score, normalize

# Global rms.max()-rms.min() conflates a real quiet-to-loud structural
# journey with dense/punchy production that's loud everywhere — measure the
# swing between segments' own mean loudness instead (EBU R128-style
# loudness range). Calibrated off real observed extremes.
DYNAMIC_CONTRAST_MAX = 0.29  # widest real segment-to-segment contrast measured

WEIGHTS = {"dynamic_contrast": 0.5, "burst_density": 0.5}


def _segment_dynamic_contrast(fb: FeatureBundle, ub: UnderstandingBundle) -> float:
    """Spread between structural segments' own mean RMS — see DYNAMIC_CONTRAST_MAX."""
    frame_times = np.arange(len(fb.rms)) * HOP_LENGTH / fb.sample_rate
    segment_means = []
    for seg in ub.structure:
        mask = (frame_times >= seg.start_sec) & (frame_times < seg.end_sec)
        if mask.any():
            segment_means.append(float(fb.rms[mask].mean()))
    return max(segment_means) - min(segment_means) if len(segment_means) > 1 else 0.0


def score_vital_tension(fb: FeatureBundle, ub: UnderstandingBundle) -> DimensionScore:
    """Cross-segment dynamic contrast + onset burst density, weighted per WEIGHTS."""
    dynamic_contrast = _segment_dynamic_contrast(fb, ub)
    dynamic_score = normalize(dynamic_contrast, DYNAMIC_CONTRAST_MAX)

    burst_density = onset_burst_density(fb.onset_strength, fb.sample_rate, fb.duration_sec)
    burst_score = normalize(burst_density, BURST_DENSITY_REFERENCE_PER_MIN)

    score = (dynamic_score * WEIGHTS["dynamic_contrast"] + burst_score * WEIGHTS["burst_density"]) * 100
    return dimension_score(
        score=score,
        evidence={
            "dynamic_contrast": dynamic_contrast,
            "burst_density": burst_density,
        },
    )
