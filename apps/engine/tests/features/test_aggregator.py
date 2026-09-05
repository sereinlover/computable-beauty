import math
from pathlib import Path

import pytest

from features.aggregator import build_feature_summary, extract_feature_bundle

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")

NOTE_NAMES = {"A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"}


def test_extract_feature_bundle_produces_reasonable_values():
    bundle = extract_feature_bundle("test-audio-id", SAMPLE_PATH)

    assert bundle.audio_id == "test-audio-id"
    assert bundle.sample_rate == 22050
    assert bundle.duration_sec == pytest.approx(30.0, abs=0.1)

    assert 60 <= bundle.bpm <= 200
    assert bundle.tempo_stability >= 0

    note, scale = bundle.key.split(" ")
    assert note in NOTE_NAMES
    assert scale in ("major", "minor")

    assert math.isfinite(bundle.dynamic_range_db)
    assert math.isfinite(bundle.spectral_entropy)
    assert 0 <= bundle.silence_ratio <= 1


def test_extract_feature_bundle_time_series_agree_on_frame_count():
    bundle = extract_feature_bundle("test-audio-id", SAMPLE_PATH)

    t = bundle.mfcc.shape[1]
    assert bundle.mel_spectrogram.shape[1] == t
    assert bundle.chroma.shape[1] == t
    assert bundle.spectral_centroid.shape[0] == t
    assert bundle.rms.shape[0] == t
    assert bundle.onset_strength.shape[0] == t


def test_build_feature_summary_keeps_only_the_wire_safe_scalars():
    bundle = extract_feature_bundle("test-audio-id", SAMPLE_PATH)
    summary = build_feature_summary(bundle)

    assert summary.bpm == round(bundle.bpm, 2)
    assert summary.tempo_stability == round(bundle.tempo_stability, 2)
    assert summary.key == bundle.key
    assert summary.dynamic_range_db == round(bundle.dynamic_range_db, 2)
    assert summary.spectral_entropy == round(bundle.spectral_entropy, 2)
    assert summary.silence_ratio == round(bundle.silence_ratio, 2)
    assert summary.duration_sec == round(bundle.duration_sec, 2)
