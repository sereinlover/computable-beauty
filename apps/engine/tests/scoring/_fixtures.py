from contracts.types import UnderstandingBundle

# All-empty placeholder — each test overrides only the fields it actually
# exercises via dataclasses.replace(), the rest are never read by the
# Scorer under test.
EMPTY_UNDERSTANDING_BUNDLE = UnderstandingBundle(
    audio_id="test",
    genre="",
    genre_confidence=0.0,
    genre_top3=[],
    emotion_labels=[],
    valence=0.0,
    arousal=0.0,
    tension=0.0,
    release=0.0,
    energy=0.0,
    emotion_arc=[],
    signature="4/4",
    instruments=[],
    structure=[],
    chords=[],
)
