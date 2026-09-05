import json
from pathlib import Path

from classifiers.instrument import HEAD_METADATA_PATH, classify_instruments

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def _valid_instrument_names() -> set[str]:
    """Derived from the same metadata file instrument.py reads, not a
    hand-copied duplicate — stays correct if the model's taxonomy changes."""
    return set(json.loads(HEAD_METADATA_PATH.read_text())["classes"])


def test_classify_instruments_returns_well_formed_entries():
    entries = classify_instruments(SAMPLE_PATH)
    valid_names = _valid_instrument_names()

    assert len(entries) > 0
    for entry in entries:
        assert entry.name in valid_names
        assert 0 <= entry.confidence <= 1

    # sorted by confidence, highest first
    confidences = [entry.confidence for entry in entries]
    assert confidences == sorted(confidences, reverse=True)

    # sample.mp3 is a piano/strings piece — piano should be the clear top pick
    assert entries[0].name == "piano"
