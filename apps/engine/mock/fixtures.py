"""
Stage 0 mock data — Yoshiki-style orchestral rock profile.

These numbers are intentionally realistic, not zeros or random.
Claude generates real explanations from these values in L4 Harness,
so mock data quality determines whether the AI explanation is coherent.
"""

MOCK_FEATURE_SUMMARY = {
    "bpm": 142.0,
    "tempo_stability": 0.03,     # very stable — characteristic of programmed drums
    "key": "D minor",
    "dynamic_range_db": 28.5,    # wide dynamic range
    "spectral_entropy": 4.2,     # rich timbre (full orchestra + distorted guitar)
    "silence_ratio": 0.06,       # sparse silence — mostly dense texture
    "duration_sec": 332.0,       # 5:32
}

MOCK_UNDERSTANDING_BUNDLE = {
    "audio_id": "mock-yoshiki-001",
    "genre": "Orchestral Rock",
    "genre_confidence": 0.87,
    "genre_top3": [
        {"label": "Orchestral Rock", "confidence": 0.87},
        {"label": "Symphonic Metal",  "confidence": 0.09},
        {"label": "Classical",        "confidence": 0.04},
    ],
    "emotion_labels": ["dramatic", "intense", "melancholic"],
    "valence": -0.28,   # slightly negative — bittersweet
    "arousal": 0.74,    # high arousal — energetic
    "tension": 0.71,    # high harmonic/rhythmic tension
    "release": 0.44,    # moderate tension resolution
    "energy": 0.58,     # overall energy level
    "emotion_arc": [
        {"timestamp_sec": 0,   "valence": -0.10, "arousal": 0.35},  # quiet intro
        {"timestamp_sec": 15,  "valence": -0.20, "arousal": 0.45},
        {"timestamp_sec": 30,  "valence": -0.45, "arousal": 0.72},  # verse builds
        {"timestamp_sec": 50,  "valence": -0.60, "arousal": 0.90},  # pre-chorus peak
        {"timestamp_sec": 65,  "valence": -0.30, "arousal": 0.95},  # chorus — highest arousal
        {"timestamp_sec": 88,  "valence": -0.55, "arousal": 0.65},  # drop back
        {"timestamp_sec": 105, "valence": -0.40, "arousal": 0.80},  # second build
        {"timestamp_sec": 130, "valence": -0.15, "arousal": 0.98},  # climax
        {"timestamp_sec": 160, "valence": -0.50, "arousal": 0.40},  # outro
    ],
    "time_signature": "4/4",
    "instruments": [
        {"name": "piano",         "confidence": 0.92},
        {"name": "orchestral strings", "confidence": 0.88},
        {"name": "electric guitar",    "confidence": 0.81},
        {"name": "drums",              "confidence": 0.95},
        {"name": "brass",              "confidence": 0.73},
    ],
    "structure": [
        {"start_sec": 0,   "end_sec": 28,  "label": "intro"},
        {"start_sec": 28,  "end_sec": 62,  "label": "verse"},
        {"start_sec": 62,  "end_sec": 96,  "label": "chorus"},
        {"start_sec": 96,  "end_sec": 124, "label": "verse"},
        {"start_sec": 124, "end_sec": 158, "label": "chorus"},
        {"start_sec": 158, "end_sec": 185, "label": "bridge"},
        {"start_sec": 185, "end_sec": 210, "label": "outro"},
    ],
    "chords": [
        {"start_sec": 0,  "end_sec": 4,  "chord": "Dm"},
        {"start_sec": 4,  "end_sec": 8,  "chord": "Bb"},
        {"start_sec": 8,  "end_sec": 12, "chord": "F"},
        {"start_sec": 12, "end_sec": 16, "chord": "C"},
        {"start_sec": 16, "end_sec": 20, "chord": "Dm"},
        {"start_sec": 20, "end_sec": 24, "chord": "Gm"},
        {"start_sec": 24, "end_sec": 28, "chord": "A"},
    ],
}

MOCK_AESTHETIC_BUNDLE = {
    "audio_id": "mock-yoshiki-001",
    "aesthetic_index": 86.1,
    "physical_precision": {
        "score": 84,
        "evidence": {
            "tempo_stability": 0.03,
            "dynamic_range_db": 28.5,
            "spectral_entropy": 4.2,
            "frequency_balance": 0.76,
        },
    },
    "structural_logic": {
        "score": 78,
        "evidence": {
            "tsd_coverage": 0.71,      # T-S-D harmonic function coverage
            "segment_balance": 0.83,   # section length distribution
            "key_stability": 0.88,
        },
    },
    "emotional_depth": {
        "score": 88,
        "evidence": {
            "valence_delta": 1.13,     # max - min valence across arc
            "polarity_switches": 5,    # negative→positive transitions
            "arousal_std": 0.24,
            "high_arousal_ratio": 0.42,
        },
    },
    "vital_tension": {
        "score": 91,
        "evidence": {
            "dynamic_contrast": 0.81,  # loudest vs quietest ratio
            "burst_density": 11.4,     # onset peaks per minute
            "silence_burst_ratio": 0.08,
            "dissonance_ratio": 0.29,
        },
    },
    "weights": {
        "physical_precision": 0.20,
        "structural_logic": 0.20,
        "emotional_depth": 0.30,
        "vital_tension": 0.30,
    },
}
