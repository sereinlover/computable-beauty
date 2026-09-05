import numpy as np
from contracts.types import DimensionScore


def normalize(value: float, reference_max: float) -> float:
    """Scales value into [0,1] relative to an expected maximum, clipping
    outliers instead of letting them blow past 1 (or below 0)."""
    return float(np.clip(value / reference_max, 0.0, 1.0))


def dimension_score(score: float, evidence: dict[str, float]) -> DimensionScore:
    """Rounds score/evidence to 2 decimals before they leave L3 — evidence
    goes straight into the LLM's context (harness/orchestrator.py), and raw
    float64 noise wastes tokens and risks the model mis-citing digits that
    don't carry real information."""
    return DimensionScore(score=round(score, 2), evidence={k: round(v, 2) for k, v in evidence.items()})
