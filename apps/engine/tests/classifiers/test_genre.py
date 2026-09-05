import json
from pathlib import Path

from classifiers.genre import HEAD_METADATA_PATH, classify_genre

SAMPLE_PATH = str(Path(__file__).parent.parent / "fixtures" / "sample.mp3")


def _valid_top_level_genres() -> set[str]:
    """Derived from the same metadata file genre.py reads, not a hand-copied
    duplicate — stays correct if the model's taxonomy ever changes."""
    classes = json.loads(HEAD_METADATA_PATH.read_text())["classes"]
    return {name.split("---")[0] for name in classes}


def test_classify_genre_returns_well_formed_top3():
    genre, confidence, top3 = classify_genre(SAMPLE_PATH)
    valid_genres = _valid_top_level_genres()

    assert len(top3) == 3
    assert top3[0].label == genre
    assert top3[0].confidence == confidence
    for entry in top3:
        assert entry.label in valid_genres
        assert 0 <= entry.confidence <= 1

    # top3 is sorted, highest confidence first
    assert top3[0].confidence >= top3[1].confidence >= top3[2].confidence
