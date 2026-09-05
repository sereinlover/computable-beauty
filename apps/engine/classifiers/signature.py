import argparse

import numpy as np
import soundfile as sf
from madmom.features.downbeats import DBNDownBeatTrackingProcessor, RNNDownBeatProcessor

from features.audio import MAX_DURATION_SEC

# Only distinguishes 3 vs 4 beats per bar — the RNN was trained mostly on
# Western pop/rock/classical, where these dominate. Compound/irregular meters
# (6/8, 5/4, 7/8) aren't just missing from the list: the RNN has little
# signal for them, "beats per bar" doesn't map 1:1 to notated time signature
# (6/8 feels like 2 beats, not 6), and the DBN's HMM assumes evenly-spaced
# beats, which asymmetric meters (3+2+2) violate.
#
# Even 3-vs-4 only tested reliable on music with a strict functional beat
# (pop, ballroom) — concert works with rubato/virtuosic figuration (4 real
# recordings tested) get misdetected regardless of arrangement.
BEATS_PER_BAR_CANDIDATES = [3, 4]

# Below this share of bars agreeing on the mode bar length, the two candidates
# are too close to commit — the value gets a trailing "?" so the UI reads it as
# a best guess, not a confident call (signature is display-only, never parsed).
MODE_AGREEMENT_THRESHOLD = 0.6

_activation_processor: RNNDownBeatProcessor | None = None
_tracking_processor: DBNDownBeatTrackingProcessor | None = None


def _load_processors() -> tuple[RNNDownBeatProcessor, DBNDownBeatTrackingProcessor]:
    """Lazy singleton — loading the RNN is expensive, no reason to redo it per request."""
    global _activation_processor, _tracking_processor
    if _activation_processor is None:
        _activation_processor = RNNDownBeatProcessor()
        _tracking_processor = DBNDownBeatTrackingProcessor(beats_per_bar=BEATS_PER_BAR_CANDIDATES, fps=100)
    return _activation_processor, _tracking_processor


def detect_signature(path: str) -> str:
    """Beats per bar via madmom's RNN downbeat activation + DBN tracking (see
    BEATS_PER_BAR_CANDIDATES), reported as "N/4" with a trailing "?" when the
    reading is ambiguous (see MODE_AGREEMENT_THRESHOLD)."""
    if sf.info(path).duration > MAX_DURATION_SEC:
        raise ValueError(f"audio duration exceeds the {MAX_DURATION_SEC}s limit")

    activation_processor, tracking_processor = _load_processors()
    activation = activation_processor(path)
    beats = tracking_processor(activation)

    # beats[:, 1] is each beat's 1-indexed position within its bar, resetting to
    # 1 at every downbeat — so the gap between consecutive downbeats is one bar's
    # length. The *mode* of those gaps is robust to a single stray bar the DBN
    # decoded as the other candidate; the old max() let one such bar flip the
    # whole track's reading (a lone position-4 beat forced 4/4).
    positions = beats[:, 1].astype(int) if beats.ndim == 2 and len(beats) else np.empty(0, dtype=int)
    downbeats = np.where(positions == 1)[0]
    if len(downbeats) < 2:
        # No complete bar to measure — whatever we report is a guess.
        fallback = int(positions.max()) if len(positions) else BEATS_PER_BAR_CANDIDATES[-1]
        return f"{fallback}/4?"

    bar_lengths = np.diff(downbeats)
    counts = np.bincount(bar_lengths)
    beats_per_bar = int(counts.argmax())
    agreement = counts.max() / len(bar_lengths)
    suffix = "" if agreement >= MODE_AGREEMENT_THRESHOLD else "?"
    return f"{beats_per_bar}/4{suffix}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect the time signature of an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    print(detect_signature(args.path))


if __name__ == "__main__":
    main()
