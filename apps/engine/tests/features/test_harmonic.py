from pathlib import Path

from features.audio import load_audio
from features.harmonic import extract_key

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")

NOTE_NAMES = {"A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"}


def test_extract_key_returns_note_scale_and_strength():
    y, sr = load_audio(SAMPLE_PATH)
    key, strength = extract_key(y, sr)
    note, scale = key.split(" ")
    assert note in NOTE_NAMES
    assert scale in ("major", "minor")
    assert 0 <= strength <= 1
