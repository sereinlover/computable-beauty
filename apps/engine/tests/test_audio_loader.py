from pathlib import Path

import numpy as np
import pytest

from features.audio_loader import MAX_DURATION_SEC, SAMPLE_RATE, load_audio

SAMPLE_PATH = str(Path(__file__).parent / "fixtures" / "sample.mp3")


def test_load_audio_returns_mono_waveform_at_target_sample_rate():
    y, sr = load_audio(SAMPLE_PATH)
    assert sr == SAMPLE_RATE
    assert isinstance(y, np.ndarray)
    assert y.ndim == 1
    assert len(y) == 30 * SAMPLE_RATE  # sample.mp3 is a known 30s clip


def test_load_audio_rejects_files_over_the_duration_limit(monkeypatch):
    def fake_librosa_load(path, sr, mono):
        # Fabricate a waveform one second past the limit instead of shipping
        # a multi-hundred-MB fixture file just to hit this branch.
        return np.zeros(sr * (MAX_DURATION_SEC + 1)), sr

    monkeypatch.setattr("features.audio_loader.librosa.load", fake_librosa_load)
    with pytest.raises(ValueError):
        load_audio("unused.mp3")  # librosa.load is mocked, the path is never read
