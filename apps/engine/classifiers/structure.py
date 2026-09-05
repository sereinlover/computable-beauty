import argparse
import os
import tempfile
from collections import Counter
from itertools import pairwise

import librosa
import msaf
import numpy as np
import soundfile as sf
from contracts.types import Segment
from msaf import input_output as msaf_io
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import pdist

from features.audio import MAX_DURATION_SEC

SAMPLE_RATE = 22050

# foote's time-scale params are frame counts, not seconds, so they don't
# adapt to duration on their own. Defaults are calibrated for ~400s tracks
# (Sargon's mean); scaling linearly against actual duration keeps a 30s clip
# from over-segmenting and a 30min track from under-segmenting.
REFERENCE_DURATION_SEC = 400
DEFAULT_M_GAUSSIAN = 66
DEFAULT_M_MEDIAN = 12
DEFAULT_L_PEAKS = 64

# MSAF's own labeling algorithm (fmc2d) doesn't scale on long tracks.
# Segments are grouped by (chroma, loudness) instead — chroma
# alone can't tell verse from chorus when both share the same key/chords, the
# common case in Western pop; loudness usually can.
CHROMA_N_FFT = 2048
CHROMA_HOP_LENGTH = 512
# Euclidean distance on the (chroma, loudness) feature below, calibrated by
# sweeping real tracks: too low over-fragments into one-off "bridge"
# segments, too high collapses everything into one cluster.
CLUSTER_DISTANCE_THRESHOLD = 0.5

# Beat-synced boundary detection often lands its last boundary a fraction of
# a beat before the track's true end. A final segment shorter than this
# merges into the previous one instead of standing on its own.
MIN_FINAL_SEGMENT_SEC = 1.0


def _scaled_config(duration_sec: float) -> dict:
    config = msaf_io.get_configuration("pcp", False, False, "foote", None)
    scale = max(1.0, duration_sec / REFERENCE_DURATION_SEC)
    config["M_gaussian"] = round(DEFAULT_M_GAUSSIAN * scale)
    config["m_median"] = round(DEFAULT_M_MEDIAN * scale)
    config["L_peaks"] = round(DEFAULT_L_PEAKS * scale)
    return config


def _detect_boundaries(path: str, duration_sec: float) -> np.ndarray:
    """msaf.run.process always writes two on-disk artifacts unscoped to the
    audio file: a feature cache at a fixed relative path, and a results
    .jams file under an "estimations" dir derived from the audio path's own
    location (assumes a dataset layout that doesn't hold for arbitrary
    uploads). Left alone this races across concurrent requests and litters
    wherever uploads live. Redirecting both to a fresh temp dir per call avoids that."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        msaf.config.features_tmp_file = os.path.join(tmp_dir, "features.json")
        msaf.config.dataset.estimations_dir = tmp_dir
        boundaries, _ = msaf.run.process(path, boundaries_id="foote", labels_id=None, n_jobs=1, config=_scaled_config(duration_sec))
    return boundaries


def _segment_feature_vectors(y: np.ndarray, boundaries: np.ndarray) -> np.ndarray:
    """Per-segment (chroma[12], loudness[1]) feature. Chroma is
    unit-normalized rather than z-scored, to keep comparing pitch-class
    shape (not raw energy) and to match the z-scored loudness dimension's
    scale. Loudness is z-scored against this track's own segments, not a
    fixed reference — same convention as burst_density/dynamic_range_db
    elsewhere in this codebase."""
    chroma_vectors = []
    energy_scalars = []
    placeholder_indices = []
    for i, (start_sec, end_sec) in enumerate(pairwise(boundaries)):
        start = int(start_sec * SAMPLE_RATE)
        end = int(end_sec * SAMPLE_RATE)
        if end - start < SAMPLE_RATE:
            # Too short for a meaningful estimate of either feature.
            chroma_vectors.append(np.full(12, 1 / 12))
            energy_scalars.append(0.0)
            placeholder_indices.append(i)
            continue
        segment = y[start:end]
        chroma = librosa.feature.chroma_stft(y=segment, sr=SAMPLE_RATE, n_fft=CHROMA_N_FFT, hop_length=CHROMA_HOP_LENGTH)
        chroma_vectors.append(chroma.mean(axis=1))
        energy_scalars.append(float(librosa.feature.rms(y=segment, hop_length=CHROMA_HOP_LENGTH)[0].mean()))

    chroma_matrix = np.array(chroma_vectors)
    chroma_norms = np.linalg.norm(chroma_matrix, axis=1, keepdims=True)
    chroma_matrix = chroma_matrix / np.where(chroma_norms < 1e-9, 1.0, chroma_norms)

    energy_vector = np.array(energy_scalars)
    if placeholder_indices and len(placeholder_indices) < len(energy_vector):
        # Real RMS is always positive, so the 0.0 placeholder above would
        # z-score into an extreme outlier and force its own singleton
        # cluster — backfill with the real segments' mean so it lands as
        # neutral in the energy dimension instead.
        real_mask = np.ones(len(energy_vector), dtype=bool)
        real_mask[placeholder_indices] = False
        energy_vector[placeholder_indices] = energy_vector[real_mask].mean()

    energy_std = energy_vector.std()
    energy_z = (energy_vector - energy_vector.mean()) / (energy_std if energy_std > 1e-9 else 1.0)

    return np.column_stack([chroma_matrix, energy_z])


def _cluster_ids(vectors: np.ndarray) -> list[int]:
    if len(vectors) < 2:
        return [0] * len(vectors)
    distances = pdist(vectors, metric="euclidean")
    linkage_matrix = linkage(distances, method="average")
    return fcluster(linkage_matrix, t=CLUSTER_DISTANCE_THRESHOLD, criterion="distance").tolist()


def _map_segment_types(cluster_ids: list[int]) -> list[str]:
    """First segment is intro, most frequent cluster is chorus, else verse. A
    non-repeating cluster is outro only at the last position — elsewhere
    it's a bridge (e.g. the common verse-chorus-verse-chorus-bridge-chorus
    form), not unconditionally outro regardless of position."""
    counts = Counter(cluster_ids)
    most_common_id, _ = counts.most_common(1)[0]
    last_index = len(cluster_ids) - 1
    types = []
    for i, cluster_id in enumerate(cluster_ids):
        if i == 0:
            types.append("intro")
        elif counts[cluster_id] == 1:
            types.append("outro" if i == last_index else "bridge")
        elif cluster_id == most_common_id:
            types.append("chorus")
        else:
            types.append("verse")
    return types


def segment_structure(path: str) -> list[Segment]:
    """Boundary detection via MSAF's foote algorithm with duration-scaled
    params; segment types via (chroma, loudness) clustering, not MSAF's own
    fmc2d (doesn't scale — see CLUSTER_DISTANCE_THRESHOLD)."""
    duration_sec = sf.info(path).duration
    if duration_sec > MAX_DURATION_SEC:
        raise ValueError(f"audio duration exceeds the {MAX_DURATION_SEC}s limit")

    boundaries = _detect_boundaries(path, duration_sec)
    if len(boundaries) > 2 and boundaries[-1] - boundaries[-2] < MIN_FINAL_SEGMENT_SEC:
        boundaries = np.concatenate([boundaries[:-2], boundaries[-1:]])

    y, _ = librosa.load(path, sr=SAMPLE_RATE, mono=True)
    vectors = _segment_feature_vectors(y, boundaries)
    types = _map_segment_types(_cluster_ids(vectors))

    return [
        Segment(start_sec=float(start), end_sec=float(end), label=label)
        for (start, end), label in zip(pairwise(boundaries), types, strict=True)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run structure segmentation on an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    for segment in segment_structure(args.path):
        print(f"{segment.start_sec:7.1f} {segment.end_sec:7.1f}  {segment.label}")


if __name__ == "__main__":
    main()
