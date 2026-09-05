import numpy as np
from contracts.types import ChordEvent, DimensionScore, FeatureBundle, UnderstandingBundle

from scoring._util import dimension_score, normalize

# Maps sharp and flat spellings to the same 0-11 pitch class (C=0) — chord
# roots (madmom, sharp-only) and key names (Essentia KeyExtractor) aren't
# guaranteed to agree on enharmonic spelling, so match by integer instead.
NOTE_TO_PITCH_CLASS = {
    "C": 0,
    "B#": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "Fb": 4,
    "F": 5,
    "E#": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
    "Cb": 11,
}

# segment_balance's std/mean ratio is unbounded above by one outlier-sized
# segment — calibrated off real tracks.
SEGMENT_BALANCE_RATIO_MAX = 2.0

# tsd_coverage/segment_balance reward harmonic conventionality, not
# richness — chord_variety covers vocabulary breadth instead. 24.0 is a
# hard ceiling (madmom's full majmin vocabulary: 12 major + 12 minor), not
# an empirical guess. Raw distinct-chord count, not count/n_events — that
# ratio inverts with song length (repetition in a long piece dilutes it).
CHORD_VOCABULARY_SIZE = 24.0

WEIGHTS = {"tsd_coverage": 0.3, "segment_balance": 0.3, "chord_variety": 0.4}


def _parse_chord(chord: str) -> tuple[int, str] | None:
    """Parses classifiers/chord.py's "G"/"Gm" style labels into (pitch_class, quality)."""
    root, quality = (chord[:-1], "min") if chord.endswith("m") else (chord, "maj")
    pitch_class = NOTE_TO_PITCH_CLASS.get(root)
    return None if pitch_class is None else (pitch_class, quality)


def _parse_key(key: str) -> tuple[int, str] | None:
    """Parses features/harmonic.py's "D minor"/"C major" into (pitch_class, mode)."""
    root, _, mode = key.partition(" ")
    pitch_class = NOTE_TO_PITCH_CLASS.get(root)
    return None if pitch_class is None else (pitch_class, mode)


def _tsd_chords(tonic_pc: int, mode: str) -> set[tuple[int, str]]:
    """Diatonic tonic/subdominant/dominant triads as (pitch_class, quality)
    pairs relative to the tonic. madmom only has major/minor triads (no
    diminished, no sevenths), so functions outside that vocabulary are
    approximated with the closest quality, not strict classical harmony."""
    if mode == "major":
        return {
            (tonic_pc, "maj"),  # I
            ((tonic_pc + 9) % 12, "min"),  # vi
            ((tonic_pc + 5) % 12, "maj"),  # IV
            ((tonic_pc + 2) % 12, "min"),  # ii
            ((tonic_pc + 7) % 12, "maj"),  # V
        }
    return {
        (tonic_pc, "min"),  # i
        ((tonic_pc + 3) % 12, "maj"),  # III
        ((tonic_pc + 8) % 12, "maj"),  # VI
        ((tonic_pc + 5) % 12, "min"),  # iv
        ((tonic_pc + 7) % 12, "min"),  # v (natural minor)
        ((tonic_pc + 7) % 12, "maj"),  # V (harmonic minor — raised leading tone is common in practice)
    }


def calc_tsd_coverage(chords: list[ChordEvent], key: str) -> float:
    """Fraction of chord events whose root+quality is a diatonic
    tonic/subdominant/dominant triad in the given key."""
    if not chords:
        return 0.0
    parsed_key = _parse_key(key)
    if parsed_key is None:
        return 0.0
    tsd_set = _tsd_chords(*parsed_key)
    matches = sum(1 for c in chords if _parse_chord(c.chord) in tsd_set)
    return matches / len(chords)


def score_structural_logic(fb: FeatureBundle, ub: UnderstandingBundle) -> DimensionScore:
    """Chord coverage of the key's tonic/subdominant/dominant function + segment-length balance + chord vocabulary breadth, weighted per WEIGHTS."""
    tsd_coverage = calc_tsd_coverage(ub.chords, fb.key)

    seg_durations = [s.end_sec - s.start_sec for s in ub.structure]
    mean_duration = float(np.mean(seg_durations))
    std_duration = float(np.std(seg_durations))
    balance_ratio = std_duration / mean_duration if mean_duration > 0 else 0.0
    balance_score = 1.0 - normalize(balance_ratio, SEGMENT_BALANCE_RATIO_MAX)

    n_distinct_chords = len({c.chord for c in ub.chords})
    chord_variety_score = normalize(n_distinct_chords, CHORD_VOCABULARY_SIZE)

    score = (
        tsd_coverage * WEIGHTS["tsd_coverage"] + balance_score * WEIGHTS["segment_balance"] + chord_variety_score * WEIGHTS["chord_variety"]
    ) * 100
    return dimension_score(
        score=score,
        evidence={
            "tsd_coverage": tsd_coverage,
            "segment_balance_ratio": balance_ratio,
            "n_distinct_chords": n_distinct_chords,
        },
    )
