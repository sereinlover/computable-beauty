from pathlib import Path

from classifiers.signature import detect_signature

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_detect_signature_returns_a_well_formed_value():
    result = detect_signature(SAMPLE_PATH)

    # A trailing "?" marks an ambiguous reading (see MODE_AGREEMENT_THRESHOLD).
    assert result.rstrip("?") in ("3/4", "4/4")
