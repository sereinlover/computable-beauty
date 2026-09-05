import librosa
import numpy as np
from contracts.types import DimensionScore, FeatureBundle

from scoring._util import dimension_score, normalize

# Reference constants below are calibrated off real observed extremes, not
# theoretical contract-range values.
TEMPO_STABILITY_UNSTABLE = 0.13  # least rhythmically stable real track measured

DYNAMIC_RANGE_DB_MIN = 5.0
DYNAMIC_RANGE_DB_MAX = 25.0  # widest real dynamic range measured

# std of mean energy across three mel-frequency thirds, in dB — dB is
# gain-invariant, raw mel power isn't (its std scales with loudness).
FREQUENCY_BALANCE_REFERENCE_STD_DB = 25.0

WEIGHTS = {"beat": 0.4, "dynamic": 0.3, "balance": 0.3}


def score_physical_precision(fb: FeatureBundle) -> DimensionScore:
    """Rhythmic stability + dynamic range + frequency balance, weighted per WEIGHTS."""
    beat_score = 1.0 - min(fb.tempo_stability / TEMPO_STABILITY_UNSTABLE, 1.0)
    dynamic_score = normalize(fb.dynamic_range_db - DYNAMIC_RANGE_DB_MIN, DYNAMIC_RANGE_DB_MAX - DYNAMIC_RANGE_DB_MIN)

    mel_db = librosa.power_to_db(fb.mel_spectrogram)
    mel_thirds = np.array_split(mel_db.mean(axis=1), 3)
    balance_std_db = float(np.std([third.mean() for third in mel_thirds]))
    balance_score = 1.0 - normalize(balance_std_db, FREQUENCY_BALANCE_REFERENCE_STD_DB)

    score = (beat_score * WEIGHTS["beat"] + dynamic_score * WEIGHTS["dynamic"] + balance_score * WEIGHTS["balance"]) * 100
    return dimension_score(
        score=score,
        evidence={
            "tempo_stability": fb.tempo_stability,
            "dynamic_range_db": fb.dynamic_range_db,
            "frequency_balance_std_db": balance_std_db,
        },
    )
