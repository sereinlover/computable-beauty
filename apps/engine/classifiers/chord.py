import argparse

import soundfile as sf
from contracts.types import ChordEvent
from madmom.audio.chroma import DeepChromaProcessor
from madmom.features.chords import DeepChromaChordRecognitionProcessor

from features.audio import MAX_DURATION_SEC

_chroma_processor: DeepChromaProcessor | None = None
_chord_processor: DeepChromaChordRecognitionProcessor | None = None


def _load_processors() -> tuple[DeepChromaProcessor, DeepChromaChordRecognitionProcessor]:
    """Lazy singleton — loading the CRF model is expensive, no reason to redo it per request."""
    global _chroma_processor, _chord_processor
    if _chroma_processor is None:
        _chroma_processor = DeepChromaProcessor()
        _chord_processor = DeepChromaChordRecognitionProcessor()
    return _chroma_processor, _chord_processor


def _format_label(madmom_label: str) -> str | None:
    """madmom's majmin vocabulary is "{root}:maj"/"{root}:min"/"N" (see
    madmom.features.chords.majmin_targets_to_chord_labels). Reformatted to
    the "G"/"Gm" style apps/web's getTonicChord() produces, so the UI's
    tonic-chord highlight can match by string equality. "N" (no chord) is dropped."""
    if madmom_label == "N":
        return None
    root, quality = madmom_label.split(":")
    return f"{root}m" if quality == "min" else root


def recognize_chords(path: str) -> list[ChordEvent]:
    """Chord recognition via madmom's DeepChromaProcessor + CRF-based
    DeepChromaChordRecognitionProcessor (majmin vocabulary: 24 major/minor
    chords + no-chord)."""
    if sf.info(path).duration > MAX_DURATION_SEC:
        raise ValueError(f"audio duration exceeds the {MAX_DURATION_SEC}s limit")

    chroma_processor, chord_processor = _load_processors()
    chroma = chroma_processor(path)
    raw_chords = chord_processor(chroma)

    return [
        ChordEvent(start_sec=float(start_sec), end_sec=float(end_sec), chord=chord)
        for start_sec, end_sec, label in raw_chords
        if (chord := _format_label(label)) is not None
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Run chord recognition on an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    for event in recognize_chords(args.path):
        print(f"{event.start_sec:7.1f} {event.end_sec:7.1f}  {event.chord}")


if __name__ == "__main__":
    main()
