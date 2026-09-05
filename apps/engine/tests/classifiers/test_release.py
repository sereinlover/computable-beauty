from pathlib import Path

from classifiers.release import compute_release

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_compute_release_returns_a_value_in_range():
    result = compute_release(SAMPLE_PATH)

    assert 0 <= result <= 1
