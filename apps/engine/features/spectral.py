import librosa
import numpy as np
from scipy.stats import entropy

N_FFT = 2048
HOP_LENGTH = 512
N_MFCC = 40
N_MELS = 128


def extract_mfcc(y: np.ndarray, sr: int) -> np.ndarray:
    """(N_MFCC, T) — per-frame timbre fingerprint."""
    return librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, n_fft=N_FFT, hop_length=HOP_LENGTH)


def extract_mel_spectrogram(y: np.ndarray, sr: int) -> np.ndarray:
    """(N_MELS, T)."""
    return librosa.feature.melspectrogram(y=y, sr=sr, n_mels=N_MELS, n_fft=N_FFT, hop_length=HOP_LENGTH)


def extract_chroma(y: np.ndarray, sr: int) -> np.ndarray:
    """(12, T) — per-frame energy across the 12 pitch classes."""
    return librosa.feature.chroma_stft(y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH)


def extract_spectral_centroid(y: np.ndarray, sr: int) -> np.ndarray:
    """(T,) — per-frame energy-weighted mean frequency."""
    return librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=N_FFT, hop_length=HOP_LENGTH)[0]


def compute_spectral_entropy(mel_spectrogram: np.ndarray) -> float:
    """Mean Shannon entropy of the per-frame mel energy distribution — higher
    means energy is spread across mel bands, lower means it's concentrated
    in a few (e.g. a pure tone). +1e-9 guards silent frames (all-zero energy)
    from a 0/0 NaN."""
    return float(entropy(mel_spectrogram + 1e-9, axis=0).mean())
