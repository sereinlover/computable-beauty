import csv
from pathlib import Path

from dataset import curate
from dataset.curate import Entry, filter_by_duration, split_dataset, write_dataset_csv


def test_filter_by_duration_drops_too_short_and_too_long(monkeypatch):
    entries = [Entry(path=Path(name), valence=0.0, arousal=0.5) for name in ("short.mp3", "ok.mp3", "long.mp3")]
    durations = {"short.mp3": 2.0, "ok.mp3": 30.0, "long.mp3": 900.0}
    monkeypatch.setattr(curate, "get_duration_sec", lambda path: durations[path.name])

    kept = filter_by_duration(entries)

    assert [e.path.name for e in kept] == ["ok.mp3"]


def test_split_dataset_is_80_10_10_and_deterministic():
    entries = [Entry(path=Path(f"{i}.mp3"), valence=0.0, arousal=0.5) for i in range(100)]

    labeled = split_dataset(entries)
    splits = [split for _entry, split in labeled]

    assert splits.count("train") == 80
    assert splits.count("val") == 10
    assert splits.count("test") == 10
    assert split_dataset(entries) == labeled  # same seed -> same split every run


def test_write_dataset_csv_writes_absolute_paths(tmp_path):
    a_path = tmp_path / "a.mp3"
    b_path = tmp_path / "b.mp3"
    labeled = [
        (Entry(path=a_path, valence=-0.5, arousal=0.3), "train"),
        (Entry(path=b_path, valence=0.2, arousal=0.9), "test"),
    ]
    out_path = tmp_path / "dataset.csv"

    write_dataset_csv(labeled, out_path)

    with open(out_path, newline="") as f:
        rows = list(csv.DictReader(f))
    assert rows == [
        {"path": str(a_path.resolve()), "valence": "-0.5", "arousal": "0.3", "split": "train"},
        {"path": str(b_path.resolve()), "valence": "0.2", "arousal": "0.9", "split": "test"},
    ]
