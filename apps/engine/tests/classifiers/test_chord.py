from itertools import pairwise
from pathlib import Path

from classifiers.chord import recognize_chords

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_recognize_chords_returns_well_formed_events():
    events = recognize_chords(SAMPLE_PATH)

    assert len(events) > 0
    for event in events:
        assert event.start_sec < event.end_sec
        assert event.chord  # "N" (no-chord) entries are dropped, never empty

    # chronological, non-overlapping
    for previous, current in pairwise(events):
        assert previous.end_sec <= current.start_sec
