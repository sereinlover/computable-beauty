import librosa
import numpy as np
import scipy.signal

HOP_LENGTH = 512
SILENCE_RMS_RATIO = 0.05  # frames below this fraction of peak RMS count as silent

# Onset-peak detection params, shared by classifiers/energy.py and
# scoring/vital_tension.py's burst_density (both derive it from the same
# FeatureBundle.onset_strength) — kept here in L1 so neither L2 nor L3 has to
# reach across into the other.
PEAK_HEIGHT_STD_MULTIPLIER = 0.5
PEAK_PROMINENCE_STD_MULTIPLIER = 0.5
MIN_PEAK_GAP_SEC = 0.1

# True min/max blows up on any track with a near-silent frame (intros,
# fades, rests) — real music tops out around 40-60dB. Percentiles trim
# that off; 5-95 lands in a plausible range where 1-99 still inflates.
DYNAMIC_RANGE_LOW_PERCENTILE = 5
DYNAMIC_RANGE_HIGH_PERCENTILE = 95


def extract_rms(y: np.ndarray, sr: int) -> np.ndarray:
    """(T,) — per-frame root-mean-square loudness."""
    return librosa.feature.rms(y=y, hop_length=HOP_LENGTH)[0]


def extract_onset_strength(y: np.ndarray, sr: int) -> np.ndarray:
    """(T,) — per-frame onset novelty, higher at note/beat attacks."""
    return librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP_LENGTH)


def onset_burst_density(onset_strength: np.ndarray, sample_rate: int, duration_sec: float) -> float:
    """Onset-strength peaks per minute. Thresholds are relative to the track's
    own mean+std (a max-min range would be skewed by a single outlier hit);
    peaks within MIN_PEAK_GAP_SEC count as one attack, since onset strength
    stays elevated for a few frames after a real attack."""
    height = onset_strength.mean() + PEAK_HEIGHT_STD_MULTIPLIER * onset_strength.std()
    prominence = PEAK_PROMINENCE_STD_MULTIPLIER * onset_strength.std()
    min_gap_frames = max(1, round(MIN_PEAK_GAP_SEC * sample_rate / HOP_LENGTH))
    peaks, _ = scipy.signal.find_peaks(onset_strength, height=height, prominence=prominence, distance=min_gap_frames)
    return len(peaks) / (duration_sec / 60)


# Empirical — the busiest real track measured. Same sharing rationale as the
# peak-detection params above: classifiers/energy.py and
# scoring/vital_tension.py both normalize onset_burst_density's output
# against this same reference, kept here so neither has its own copy to
# drift out of sync.
BURST_DENSITY_REFERENCE_PER_MIN = 310.0


def _trim_silence_edges(rms: np.ndarray) -> np.ndarray:
    """Drops leading/trailing frames quieter than SILENCE_RMS_RATIO of peak.

    A fade-in/fade-out is common mixing practice, not expressive dynamics,
    and can otherwise drag the low percentile down to near-silence. Only
    edges are trimmed — a quiet passage mid-track is real dynamics, not a
    fade, and stays in.
    """
    above_threshold = np.where(rms > rms.max() * SILENCE_RMS_RATIO)[0]
    if len(above_threshold) == 0:
        return rms
    return rms[above_threshold[0] : above_threshold[-1] + 1]


def compute_dynamic_range_db(rms: np.ndarray) -> float:
    """95th vs 5th percentile RMS, in dB — not true min/max, see DYNAMIC_RANGE_LOW_PERCENTILE."""
    trimmed = _trim_silence_edges(rms)
    loud = np.percentile(trimmed, DYNAMIC_RANGE_HIGH_PERCENTILE)
    quiet = np.percentile(trimmed, DYNAMIC_RANGE_LOW_PERCENTILE)
    return float(20 * np.log10(loud / (quiet + 1e-9)))


def compute_silence_ratio(rms: np.ndarray) -> float:
    """Fraction of frames quieter than SILENCE_RMS_RATIO of the track's peak RMS."""
    threshold = SILENCE_RMS_RATIO * rms.max()
    return float(np.mean(rms < threshold))
