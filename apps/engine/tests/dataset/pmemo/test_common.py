from pathlib import Path

import pytest

from dataset.pmemo.common import load_file_names, rescale_valence

FIXTURE_ROOT = Path(__file__).parent.parent.parent / "fixtures" / "pmemo_mini"


def test_load_file_names_maps_music_id_to_file_name():
    file_names = load_file_names(FIXTURE_ROOT)
    assert file_names == {"1": "1.mp3", "2": "2.mp3", "3": "3.mp3"}


def test_rescale_valence_maps_0_1_to_minus_1_1():
    assert rescale_valence(0.0) == pytest.approx(-1.0)
    assert rescale_valence(1.0) == pytest.approx(1.0)
    assert rescale_valence(0.5) == pytest.approx(0.0)
