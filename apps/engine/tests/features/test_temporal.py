import math
from pathlib import Path

from features.audio import load_audio
from features.temporal import extract_tempo

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def test_extract_tempo_returns_reasonable_bpm_and_stability():
    y, sr = load_audio(SAMPLE_PATH)
    bpm, tempo_stability = extract_tempo(y, sr)
    assert 40 <= bpm <= 220
    assert tempo_stability >= 0
    assert math.isfinite(tempo_stability)
