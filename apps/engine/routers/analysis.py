# L1-L3 endpoints — deterministic, no LLM involved.

import time

from contracts.types import AestheticBundle, FeatureSummary, UnderstandingBundle
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import verify_internal_token
from mock.fixtures import MOCK_AESTHETIC_BUNDLE, MOCK_FEATURE_SUMMARY, MOCK_UNDERSTANDING_BUNDLE

router = APIRouter(dependencies=[Depends(verify_internal_token)])


class ExtractFeaturesRequest(BaseModel):
    audio_id: str
    audio_path: str


class ClassifyRequest(BaseModel):
    audio_id: str
    audio_path: str
    feature_summary: dict


class ScoreAestheticsRequest(BaseModel):
    audio_id: str
    audio_path: str
    feature_summary: dict
    understanding: dict


@router.post("/internal/extract-features", response_model=FeatureSummary)
def extract_features(payload: ExtractFeaturesRequest) -> FeatureSummary:
    time.sleep(20)
    return MOCK_FEATURE_SUMMARY


@router.post("/internal/classify", response_model=UnderstandingBundle)
def classify(payload: ClassifyRequest) -> UnderstandingBundle:
    time.sleep(20)
    return MOCK_UNDERSTANDING_BUNDLE


@router.post("/internal/score-aesthetics", response_model=AestheticBundle)
def score_aesthetics(payload: ScoreAestheticsRequest) -> AestheticBundle:
    time.sleep(20)
    return MOCK_AESTHETIC_BUNDLE
