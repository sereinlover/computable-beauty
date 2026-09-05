import argparse

import numpy as np
from contracts.types import FeatureBundle

from features.aggregator import extract_feature_bundle
from features.dynamic import BURST_DENSITY_REFERENCE_PER_MIN, onset_burst_density

# p90, not mean: mean RMS rewards consistent loudness over dramatic loudness
# (a flat-loud children's song beat a genuine quiet-verse/loud-chorus ballad
# on mean RMS, even though the ballad's peaks were far louder). p90 rewards
# how loud the energetic moments get while still ignoring a few outlier frames.
LOUDNESS_PERCENTILE = 90

# Onset density is the other half of "feels energetic" (per Spotify's energy
# feature: loudness + onset rate + timbre) — loudness alone can't tell a
# merely-loud track from a busy, driving one.
LOUDNESS_REFERENCE = 0.50  # empirical — the loudest real track measured scored ~0.9

WEIGHTS = {"loudness": 0.5, "burst_density": 0.5}


def compute_energy(fb: FeatureBundle) -> float:
    """Perceptual sense of intensity/activity, not just average loudness —
    combines how loud the track's energetic moments get with how dense its
    rhythmic activity is."""
    loudness = float(np.percentile(fb.rms, LOUDNESS_PERCENTILE))
    loudness_score = np.clip(loudness / LOUDNESS_REFERENCE, 0.0, 1.0)

    burst_density = onset_burst_density(fb.onset_strength, fb.sample_rate, fb.duration_sec)
    burst_score = np.clip(burst_density / BURST_DENSITY_REFERENCE_PER_MIN, 0.0, 1.0)

    return float(loudness_score * WEIGHTS["loudness"] + burst_score * WEIGHTS["burst_density"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute the energy level of an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    fb = extract_feature_bundle(args.path, args.path)
    print(f"{compute_energy(fb):.4f}")


if __name__ == "__main__":
    main()
