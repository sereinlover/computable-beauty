# L4 endpoints — explain and chat, the only two that call a real LLM (see
# harness/orchestrator.py).

from contracts.types import AestheticBundle, AnalysisResult, FeatureSummary, UnderstandingBundle
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import verify_internal_token
from harness.orchestrator import run_chat, run_explain

router = APIRouter(dependencies=[Depends(verify_internal_token)])


class ExplainRequest(BaseModel):
    audio_id: str
    audio_path: str
    job_id: str
    language: str  # "zh" | "en" — see harness/system_prompt.py's LANGUAGE_NAMES
    feature_summary: FeatureSummary
    understanding: UnderstandingBundle
    aesthetic: AestheticBundle


class ChatRequest(BaseModel):
    audio_id: str
    question: str
    language: str  # "zh" | "en" — see harness/system_prompt.py's LANGUAGE_NAMES
    feature_summary: FeatureSummary
    understanding: UnderstandingBundle
    aesthetic: AestheticBundle
    summary: str
    explanation: str


class ChatResponse(BaseModel):
    answer: str


@router.post("/internal/explain", response_model=AnalysisResult)
def explain(payload: ExplainRequest) -> AnalysisResult:
    return run_explain(
        audio_id=payload.audio_id,
        language=payload.language,
        feature_summary=payload.feature_summary,
        understanding=payload.understanding,
        aesthetic=payload.aesthetic,
    )


@router.post("/internal/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    answer = run_chat(
        audio_id=payload.audio_id,
        question=payload.question,
        language=payload.language,
        feature_summary=payload.feature_summary,
        understanding=payload.understanding,
        aesthetic=payload.aesthetic,
        summary=payload.summary,
        explanation=payload.explanation,
    )
    return ChatResponse(answer=answer)
