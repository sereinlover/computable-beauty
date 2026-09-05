import argparse

import numpy as np
import scipy.signal

from classifiers.tension import HOP_SIZE, SAMPLE_RATE, frame_dissonance

FRAME_SEC = HOP_SIZE / SAMPLE_RATE

# Same robust-to-outliers approach as scoring/vital_tension.py's burst
# detection — thresholds relative to the track's own mean+std, not a fixed
# value or the track's own max-min range (sensitive to a single outlier).
HEIGHT_STD_MULTIPLIER = 0.5
PROMINENCE_STD_MULTIPLIER = 0.5

# Peaks closer together than this are treated as the same tension build,
# not two separate ones.
MIN_PEAK_GAP_SEC = 0.5

# How long after a tension peak to look for the resolution — long enough to
# capture a real cadence (a chord resolving over the next beat or two), not
# so long it starts averaging in the next unrelated passage.
RESOLUTION_WINDOW_SEC = 1.5

# Empirical — the largest average post-peak drop observed across 26 real
# tracks scored ~0.9.
REFERENCE_MEAN_DROP = 0.147


def compute_release(path: str) -> float:
    """How much dissonance resolves after its own peaks — tension and
    release are two sides of the same frame_dissonance series, not
    independent signals."""
    dissonance = frame_dissonance(path)
    if len(dissonance) == 0:
        return 0.0

    height = dissonance.mean() + HEIGHT_STD_MULTIPLIER * dissonance.std()
    prominence = PROMINENCE_STD_MULTIPLIER * dissonance.std()
    min_gap_frames = max(1, round(MIN_PEAK_GAP_SEC / FRAME_SEC))
    peaks, _ = scipy.signal.find_peaks(dissonance, height=height, prominence=prominence, distance=min_gap_frames)

    window_frames = max(1, round(RESOLUTION_WINDOW_SEC / FRAME_SEC))
    drops = [dissonance[i] - dissonance[i + 1 : i + 1 + window_frames].mean() for i in peaks if i + 1 + window_frames <= len(dissonance)]
    if not drops:
        return 0.0
    return float(np.clip(np.mean(drops) / REFERENCE_MEAN_DROP, 0.0, 1.0))


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute the harmonic tension release of an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    print(f"{compute_release(args.path):.4f}")


if __name__ == "__main__":
    main()
