from pathlib import Path

from classifiers.tension import compute_tension, frame_dissonance

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_frame_dissonance_returns_values_in_range():
    values = frame_dissonance(SAMPLE_PATH)

    assert len(values) > 0
    assert (values >= 0).all()
    assert (values <= 1).all()


def test_compute_tension_returns_a_value_in_range():
    result = compute_tension(SAMPLE_PATH)

    assert 0 <= result <= 1
