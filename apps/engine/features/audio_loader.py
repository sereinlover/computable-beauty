import librosa
import numpy as np

SAMPLE_RATE = 22050
MAX_DURATION_SEC = 3600


def load_audio(path: str) -> tuple[np.ndarray, int]:
    """Decode an audio file to a mono waveform resampled to SAMPLE_RATE."""
    y, sr = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    duration_sec = len(y) / sr
    if duration_sec > MAX_DURATION_SEC:
        raise ValueError(f"audio duration {duration_sec:.1f}s exceeds the {MAX_DURATION_SEC}s limit")
    return y, int(sr)
