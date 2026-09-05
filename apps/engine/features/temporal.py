import librosa
import numpy as np


def extract_tempo(y: np.ndarray, sr: int) -> tuple[float, float]:
    """Returns (bpm, tempo_stability) — tempo_stability is the std of inter-beat
    intervals in seconds (lower = steadier tempo)."""
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    # Fewer than 2 beats means no interval to measure stability from.
    tempo_stability = float(np.std(np.diff(beat_times))) if len(beat_times) > 1 else 0.0
    # librosa returns tempo as a 1-element array (supports multi-tempo estimation).
    return float(tempo[0]), tempo_stability
