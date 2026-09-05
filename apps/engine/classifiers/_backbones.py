"""Shared embedding-model singletons, one getter per backbone. Classification
heads stay local to whichever classifier owns them (not shared); only the
backbone underneath is duplicated work worth avoiding — genre.py and
instrument.py both build on discogs-effnet's output, emotion.py on
msd-musicnn's. Loading either twice would double its in-memory footprint
for identical weights, so each goes through its own lazy singleton here
instead of every caller keeping its own copy."""

from pathlib import Path

import essentia.standard as es

_DISCOGS_EFFNET_MODEL_PATH = Path(__file__).parent / "models" / "discogs-effnet-bs64-1.pb"
_MSD_MUSICNN_MODEL_PATH = Path(__file__).parent / "models" / "msd-musicnn-1.pb"

_discogs_effnet_model: es.TensorflowPredictEffnetDiscogs | None = None
_msd_musicnn_model: es.TensorflowPredictMusiCNN | None = None


def get_discogs_effnet_model() -> es.TensorflowPredictEffnetDiscogs:
    global _discogs_effnet_model
    if _discogs_effnet_model is None:
        _discogs_effnet_model = es.TensorflowPredictEffnetDiscogs(graphFilename=str(_DISCOGS_EFFNET_MODEL_PATH), output="PartitionedCall:1")
    return _discogs_effnet_model


def get_msd_musicnn_model() -> es.TensorflowPredictMusiCNN:
    global _msd_musicnn_model
    if _msd_musicnn_model is None:
        _msd_musicnn_model = es.TensorflowPredictMusiCNN(graphFilename=str(_MSD_MUSICNN_MODEL_PATH), output="model/dense/BiasAdd")
    return _msd_musicnn_model
