import argparse

import essentia
import essentia.standard as es
import numpy as np

essentia.log.warningActive = False

SAMPLE_RATE = 44100
FRAME_SIZE = 2048
HOP_SIZE = 1024

# Empirical — the most dissonant real track's mean frame dissonance measured
# scored ~0.9.
REFERENCE_MEAN_DISSONANCE = 0.51

_windowing: es.Windowing | None = None
_spectrum: es.Spectrum | None = None
_spectral_peaks: es.SpectralPeaks | None = None
_dissonance: es.Dissonance | None = None


def _load_algorithms() -> tuple[es.Windowing, es.Spectrum, es.SpectralPeaks, es.Dissonance]:
    """Lazy singleton, same pattern as the other classifiers — these are
    cheap to construct but no reason to redo it per request either."""
    global _windowing, _spectrum, _spectral_peaks, _dissonance
    if _windowing is None:
        _windowing = es.Windowing(type="hann")
        _spectrum = es.Spectrum()
        _spectral_peaks = es.SpectralPeaks()
        _dissonance = es.Dissonance()
    return _windowing, _spectrum, _spectral_peaks, _dissonance


def frame_dissonance(path: str) -> np.ndarray:
    """Per-frame sensory dissonance (Plomp & Levelt 1965) from spectral
    peaks — 0 fully consonant, 1 fully dissonant. Needs the raw waveform,
    not FeatureBundle's mel-scale spectrogram, so this decodes its own
    audio rather than reusing FeatureBundle (same pattern as
    classifiers/chord.py, classifiers/signature.py)."""
    audio = es.MonoLoader(filename=path, sampleRate=SAMPLE_RATE)()
    windowing, spectrum, spectral_peaks, dissonance = _load_algorithms()

    values = []
    for frame in es.FrameGenerator(audio, frameSize=FRAME_SIZE, hopSize=HOP_SIZE, startFromZero=True):
        freqs, mags = spectral_peaks(spectrum(windowing(frame)))
        if len(freqs) == 0:
            continue
        values.append(dissonance(freqs, mags))
    return np.array(values)


def compute_tension(path: str) -> float:
    values = frame_dissonance(path)
    if len(values) == 0:
        return 0.0
    return float(np.clip(values.mean() / REFERENCE_MEAN_DISSONANCE, 0.0, 1.0))


def main() -> None:
    parser = argparse.ArgumentParser(description="Compute the harmonic tension (mean dissonance) of an audio file.")
    parser.add_argument("path", help="path to an audio file")
    args = parser.parse_args()

    print(f"{compute_tension(args.path):.4f}")


if __name__ == "__main__":
    main()
