import logging

from contracts.types import FeatureBundle, FeatureSummary

from features.audio import load_audio
from features.dynamic import compute_dynamic_range_db, compute_silence_ratio, extract_onset_strength, extract_rms
from features.harmonic import extract_key
from features.spectral import (
    compute_spectral_entropy,
    extract_chroma,
    extract_mel_spectrogram,
    extract_mfcc,
    extract_spectral_centroid,
)
from features.temporal import extract_tempo

logger = logging.getLogger(__name__)


def extract_feature_bundle(audio_id: str, path: str) -> FeatureBundle:
    """Runs the full L1 extractor pipeline on an audio file and assembles a FeatureBundle."""
    y, sr = load_audio(path)
    duration_sec = len(y) / sr

    mfcc = extract_mfcc(y, sr)
    logger.info("[aggregator] audio_id=%s mfcc.shape=%s", audio_id, mfcc.shape)

    mel_spectrogram = extract_mel_spectrogram(y, sr)
    logger.info("[aggregator] audio_id=%s mel_spectrogram.shape=%s", audio_id, mel_spectrogram.shape)

    chroma = extract_chroma(y, sr)
    logger.info("[aggregator] audio_id=%s chroma.shape=%s", audio_id, chroma.shape)

    spectral_centroid = extract_spectral_centroid(y, sr)
    logger.info("[aggregator] audio_id=%s spectral_centroid.shape=%s", audio_id, spectral_centroid.shape)

    spectral_entropy = compute_spectral_entropy(mel_spectrogram)
    logger.info("[aggregator] audio_id=%s spectral_entropy=%.3f", audio_id, spectral_entropy)

    bpm, tempo_stability = extract_tempo(y, sr)
    logger.info("[aggregator] audio_id=%s bpm=%.3f tempo_stability=%.3f", audio_id, bpm, tempo_stability)

    key, key_strength = extract_key(y, sr)
    logger.info("[aggregator] audio_id=%s key=%s strength=%.3f", audio_id, key, key_strength)

    rms = extract_rms(y, sr)
    logger.info("[aggregator] audio_id=%s rms.shape=%s", audio_id, rms.shape)

    onset_strength = extract_onset_strength(y, sr)
    logger.info("[aggregator] audio_id=%s onset_strength.shape=%s", audio_id, onset_strength.shape)

    dynamic_range_db = compute_dynamic_range_db(rms)
    logger.info("[aggregator] audio_id=%s dynamic_range_db=%.3f", audio_id, dynamic_range_db)

    silence_ratio = compute_silence_ratio(rms)
    logger.info("[aggregator] audio_id=%s silence_ratio=%.3f", audio_id, silence_ratio)

    return FeatureBundle(
        audio_id=audio_id,
        duration_sec=duration_sec,
        sample_rate=sr,
        mfcc=mfcc,
        mel_spectrogram=mel_spectrogram,
        chroma=chroma,
        spectral_centroid=spectral_centroid,
        rms=rms,
        onset_strength=onset_strength,
        bpm=bpm,
        tempo_stability=tempo_stability,
        key=key,
        dynamic_range_db=dynamic_range_db,
        spectral_entropy=spectral_entropy,
        silence_ratio=silence_ratio,
    )


def build_feature_summary(bundle: FeatureBundle) -> FeatureSummary:
    """Drops the FeatureBundle's numpy time series, keeping only the wire-safe scalars.

    Rounded to 2 decimals for the same reason as scoring/_util.py's dimension_score() —
    this whole struct gets dumped into the LLM's context (harness/orchestrator.py), and
    raw float64 noise wastes tokens without adding real information.
    """
    return FeatureSummary(
        bpm=round(bundle.bpm, 2),
        tempo_stability=round(bundle.tempo_stability, 2),
        key=bundle.key,
        dynamic_range_db=round(bundle.dynamic_range_db, 2),
        spectral_entropy=round(bundle.spectral_entropy, 2),
        silence_ratio=round(bundle.silence_ratio, 2),
        duration_sec=round(bundle.duration_sec, 2),
    )
