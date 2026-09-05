from pathlib import Path

import pytest

from dataset.pmemo.load import load_pmemo_static

FIXTURE_ROOT = Path(__file__).parent.parent.parent / "fixtures" / "pmemo_mini"


def test_load_pmemo_static_drops_clips_without_a_static_annotation():
    entries = load_pmemo_static(FIXTURE_ROOT)
    assert {e.path.name for e in entries} == {"1.mp3", "2.mp3"}  # musicId 3 has no annotation


def test_load_pmemo_static_rescales_valence_to_contract_scale():
    entries = {e.path.name: e for e in load_pmemo_static(FIXTURE_ROOT)}

    assert entries["1.mp3"].valence == pytest.approx(0.575 * 2 - 1)
    assert entries["1.mp3"].arousal == pytest.approx(0.4)  # arousal is already 0..1, unchanged

    assert entries["2.mp3"].valence == pytest.approx(0.1 * 2 - 1)
    assert entries["2.mp3"].arousal == pytest.approx(0.8)


def test_load_pmemo_static_paths_point_into_the_chorus_directory():
    entries = load_pmemo_static(FIXTURE_ROOT)
    assert all(e.path.parent == FIXTURE_ROOT / "chorus" for e in entries)
