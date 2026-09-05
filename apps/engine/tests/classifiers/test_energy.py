import copy
from pathlib import Path

import numpy as np

from classifiers.energy import compute_energy
from features.aggregator import extract_feature_bundle

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_compute_energy_returns_a_value_in_range():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    result = compute_energy(fb)

    assert 0 <= result <= 1


def test_compute_energy_rewards_louder_rms():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    quiet = compute_energy(fb)

    louder_fb = copy.copy(fb)
    louder_fb.rms = fb.rms * 1.5
    louder = compute_energy(louder_fb)

    assert louder > quiet


def test_compute_energy_rewards_denser_onsets():
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    n_frames = 3000

    sparse_fb = copy.copy(fb)
    sparse_onset = np.full(n_frames, 1.0)
    sparse_onset[::40] = 3.0  # a burst every 40 frames
    sparse_fb.onset_strength = sparse_onset

    dense_fb = copy.copy(fb)
    dense_onset = np.full(n_frames, 1.0)
    dense_onset[::10] = 3.0  # a burst every 10 frames — 4x denser
    dense_fb.onset_strength = dense_onset

    assert compute_energy(dense_fb) > compute_energy(sparse_fb)


def test_compute_energy_burst_density_is_relative_to_each_track_own_onset_range():
    # Same robustness property as scoring/vital_tension.py's burst_density —
    # scaling onset_strength up shouldn't change how many peaks are found.
    fb = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    loud_fb = copy.copy(fb)
    loud_fb.onset_strength = fb.onset_strength * 10

    assert compute_energy(fb) == compute_energy(loud_fb)
