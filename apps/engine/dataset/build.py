import argparse
from pathlib import Path

from dataset.curate import filter_by_duration, split_dataset, write_dataset_csv
from dataset.pmemo.load import load_pmemo_static


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a unified dataset.csv from one or more emotion datasets.")
    parser.add_argument("--pmemo-static", type=Path, help="path to a PMEmo2019 directory")
    parser.add_argument("--out", type=Path, default=Path("data/dataset.csv"))
    args = parser.parse_args()

    entries = []
    if args.pmemo_static:
        entries += load_pmemo_static(args.pmemo_static)

    entries = filter_by_duration(entries)
    labeled = split_dataset(entries)
    write_dataset_csv(labeled, args.out)
    print(f"wrote {len(labeled)} rows to {args.out}")


if __name__ == "__main__":
    main()
