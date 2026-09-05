import csv
from pathlib import Path


def load_file_names(root: Path) -> dict[str, str]:
    """musicId -> fileName from metadata.csv — shared across annotation
    loaders that only differ in annotation grain."""
    file_names = {}
    with open(root / "metadata.csv", newline="") as f:
        for row in csv.DictReader(f):
            file_names[row["musicId"]] = row["fileName"]
    return file_names


def rescale_valence(valence_01: float) -> float:
    """PMEmo's native [0,1] valence -> the contract's -1..1 (arousal needs no rescaling)."""
    return valence_01 * 2 - 1
