from itertools import pairwise
from pathlib import Path

from classifiers.structure import segment_structure

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")

VALID_LABELS = {"intro", "verse", "chorus", "bridge", "outro"}


def test_segment_structure_returns_well_formed_segments():
    segments = segment_structure(SAMPLE_PATH)

    assert len(segments) > 0
    assert segments[0].start_sec == 0.0
    assert segments[0].label == "intro"

    for segment in segments:
        assert segment.start_sec < segment.end_sec
        assert segment.label in VALID_LABELS

    # segments are contiguous and cover the full track, no gaps or overlaps
    for previous, current in pairwise(segments):
        assert previous.end_sec == current.start_sec
