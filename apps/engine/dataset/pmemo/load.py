import csv
from pathlib import Path

from dataset.curate import Entry
from dataset.pmemo.common import load_file_names, rescale_valence


def load_pmemo_static(root: Path) -> list[Entry]:
    """Reads a PMEmo2019 directory, returns one Entry per annotated chorus clip
    (794 clips total, only 767 have a static annotation — every annotated
    musicId does have a metadata.csv row, so the annotation file is safe to
    drive the loop)."""
    file_names = load_file_names(root)

    entries = []
    with open(root / "annotations" / "static_annotations.csv", newline="") as f:
        for row in csv.DictReader(f):
            arousal_01 = float(row["Arousal(mean)"])
            valence_01 = float(row["Valence(mean)"])
            path = root / "chorus" / file_names[row["musicId"]]
            entries.append(Entry(path=path, valence=rescale_valence(valence_01), arousal=arousal_01))
    return entries
