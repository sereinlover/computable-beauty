import essentia.standard as es
import numpy as np


def extract_key(y: np.ndarray, sr: int) -> tuple[str, float]:
    """Returns (key, strength) — key e.g. "D minor", via essentia's KeyExtractor
    (accuracy-first over a hand-rolled Krumhansl template match). strength is
    essentia's 0-1 confidence in the match; callers may log it, it doesn't
    cross into FeatureSummary/FeatureBundle."""
    key, scale, strength = es.KeyExtractor(sampleRate=sr)(y)
    return f"{key} {scale}", strength
