import math
from pathlib import Path

from features.audio import load_audio
from features.spectral import (
    compute_spectral_entropy,
    extract_chroma,
    extract_mel_spectrogram,
    extract_mfcc,
    extract_spectral_centroid,
)

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_extract_mfcc_shape():
    y, sr = load_audio(SAMPLE_PATH)
    mfcc = extract_mfcc(y, sr)
    assert mfcc.shape[0] == 40


def test_extract_mel_spectrogram_shape():
    y, sr = load_audio(SAMPLE_PATH)
    mel = extract_mel_spectrogram(y, sr)
    assert mel.shape[0] == 128


def test_extract_chroma_shape():
    y, sr = load_audio(SAMPLE_PATH)
    chroma = extract_chroma(y, sr)
    assert chroma.shape[0] == 12


def test_extract_spectral_centroid_shape():
    y, sr = load_audio(SAMPLE_PATH)
    centroid = extract_spectral_centroid(y, sr)
    assert centroid.ndim == 1


def test_extractors_agree_on_frame_count():
    y, sr = load_audio(SAMPLE_PATH)
    t = extract_mfcc(y, sr).shape[1]
    assert extract_mel_spectrogram(y, sr).shape[1] == t
    assert extract_chroma(y, sr).shape[1] == t
    assert extract_spectral_centroid(y, sr).shape[0] == t


def test_compute_spectral_entropy_is_finite_and_nonnegative():
    y, sr = load_audio(SAMPLE_PATH)
    mel = extract_mel_spectrogram(y, sr)
    spectral_entropy = compute_spectral_entropy(mel)
    assert math.isfinite(spectral_entropy)
    assert spectral_entropy >= 0
