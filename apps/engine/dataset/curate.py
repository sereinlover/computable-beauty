import csv
import random
from dataclasses import dataclass
from pathlib import Path

import soundfile as sf

MIN_DURATION_SEC = 5
MAX_DURATION_SEC = 600
SPLIT_RATIOS = (0.8, 0.1, 0.1)  # train, val, test
SPLIT_SEED = 42


@dataclass
class Entry:
    path: Path
    valence: float  # contract scale, -1..1
    arousal: float  # contract scale, 0..1


def get_duration_sec(path: Path) -> float:
    return sf.info(path).duration


def filter_by_duration(entries: list[Entry]) -> list[Entry]:
    return [e for e in entries if MIN_DURATION_SEC <= get_duration_sec(e.path) <= MAX_DURATION_SEC]


def split_dataset(entries: list[Entry]) -> list[tuple[Entry, str]]:
    """Deterministic 80/10/10 train/val/test split."""
    shuffled = entries.copy()
    random.Random(SPLIT_SEED).shuffle(shuffled)
    n_train = int(len(shuffled) * SPLIT_RATIOS[0])
    n_val = int(len(shuffled) * SPLIT_RATIOS[1])

    labeled = []
    for i, entry in enumerate(shuffled):
        split = "train" if i < n_train else "val" if i < n_train + n_val else "test"
        labeled.append((entry, split))
    return labeled


def write_dataset_csv(labeled: list[tuple[Entry, str]], out_path: Path) -> None:
    """Writes absolute paths — dataset.csv should resolve to the right files
    regardless of which directory it's later read from."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["path", "valence", "arousal", "split"])
        for entry, split in labeled:
            writer.writerow([str(entry.path.resolve()), entry.valence, entry.arousal, split])
