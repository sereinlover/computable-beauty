import math
from pathlib import Path

import numpy as np

from features.audio import load_audio
from features.dynamic import compute_dynamic_range_db, compute_silence_ratio, extract_onset_strength, extract_rms

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_extract_rms_shape():
    y, sr = load_audio(SAMPLE_PATH)
    rms = extract_rms(y, sr)
    assert rms.ndim == 1
    assert rms.min() >= 0


def test_extract_onset_strength_shape():
    y, sr = load_audio(SAMPLE_PATH)
    onset_strength = extract_onset_strength(y, sr)
    assert onset_strength.ndim == 1


def test_extractors_agree_on_frame_count():
    y, sr = load_audio(SAMPLE_PATH)
    assert extract_onset_strength(y, sr).shape[0] == extract_rms(y, sr).shape[0]


def test_compute_dynamic_range_db_is_finite_and_plausible():
    y, sr = load_audio(SAMPLE_PATH)
    rms = extract_rms(y, sr)
    dynamic_range_db = compute_dynamic_range_db(rms)
    assert math.isfinite(dynamic_range_db)
    # Real music tops out around 40-60dB — a true min/max ratio blows past
    # this on any track with a near-silent frame (a real bug this caught).
    assert 0 <= dynamic_range_db <= 80


def test_compute_dynamic_range_db_ignores_a_fade_out_tail():
    # A fade-out is common mixing practice, not evidence of expressive
    # dynamics, and can otherwise dominate the low percentile. Genuine
    # internal dynamics (a real quiet-to-loud section, not a fade) should
    # still count.
    genuine_dynamics = np.concatenate([np.full(200, 0.05), np.full(200, 0.2)])
    fade_out = 0.2 * np.exp(-np.linspace(0, 10, 100))  # decays well past the silence threshold
    with_fade_tail = np.concatenate([genuine_dynamics, fade_out])

    assert compute_dynamic_range_db(with_fade_tail) == compute_dynamic_range_db(genuine_dynamics)


def test_compute_silence_ratio_is_a_fraction():
    y, sr = load_audio(SAMPLE_PATH)
    rms = extract_rms(y, sr)
    silence_ratio = compute_silence_ratio(rms)
    assert 0 <= silence_ratio <= 1
