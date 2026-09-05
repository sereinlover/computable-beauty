"""L4 Harness Orchestrator — the one place that calls a real LLM.

Treats L1-L3's outputs (feature_summary/understanding/aesthetic) as
already-computed context and runs a tool-use loop where the model must call
`explain_dimension` once per aesthetic dimension (see
harness/tools/explain_dimension/TOOL.md for why the tool itself doesn't
generate text). `run_explain` produces the initial AnalysisResult; `run_chat`
answers a stateless follow-up question, rebuilding context fresh each call
from what Gateway already has on hand.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict
from typing import cast

from contracts.types import AestheticBundle, AnalysisResult, FeatureSummary, ToolCallRecord, UnderstandingBundle
from openai import OpenAI
from openai.types.chat import (
    ChatCompletionFunctionToolParam,
    ChatCompletionMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionToolMessageParam,
    ChatCompletionUserMessageParam,
)
from openai.types.shared_params import FunctionDefinition

from harness.registry import TOOL_REGISTRY
from harness.system_prompt import CHAT_SYSTEM_PROMPT, EXPLAIN_SYSTEM_PROMPT, LANGUAGE_NAMES

logger = logging.getLogger(__name__)

# Lazy: constructing OpenAI(...) at import time would crash the whole engine
# process whenever OPENAI_API_KEY is empty (main.py imports this
# unconditionally). Building on first use means only an actual
# run_explain/run_chat call can fail on a missing key — and Gateway already
# skips calling run_explain when there's no key (biz.Worker.runPipeline's
# HasOpenAIKey check).
_client: OpenAI | None = None

# Kept below gateway/internal/data/engine_client.go's engineRequestTimeout (10
# minutes) so a slow LLM call fails here first, instead of Gateway cutting the
# connection while this call is still running unattended.
_LLM_TIMEOUT_SECONDS = 8 * 60


def _get_client() -> OpenAI:
    global _client
    client = _client
    if client is None:
        client = OpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.environ["OPENAI_BASE_URL"],
            timeout=_LLM_TIMEOUT_SECONDS,
        )
        _client = client
    return client


DIMENSION_ORDER = ["physical_precision", "structural_logic", "emotional_depth", "vital_tension"]

# run_explain's tool-use loop needs headroom for a full explanation across all
# four dimensions; run_chat answers one question, so a smaller cap is enough.
EXPLAIN_MAX_TOKENS = 2048
CHAT_MAX_TOKENS = 1024

# Per-language display labels — fed into run_explain's system prompt so the
# LLM has one canonical name per dimension to copy, instead of inventing its
# own translation of the raw field name (and drifting between synonyms)
# each time it's mentioned; also reused verbatim for the heading below.
DIMENSION_LABELS = {
    "zh": {
        "physical_precision": "物理精确性",
        "structural_logic": "结构逻辑",
        "emotional_depth": "情感深度",
        "vital_tension": "活力张力",
    },
    "en": {
        "physical_precision": "Physical Precision",
        "structural_logic": "Structural Logic",
        "emotional_depth": "Emotional Depth",
        "vital_tension": "Vital Tension",
    },
}


def _openai_tools() -> list[ChatCompletionFunctionToolParam]:
    """Convert registry.py's schema shape (name/description/input_schema) into
    OpenAI's function-calling shape. Kept local to this module so the
    registry/TOOL.md contract format stays SDK-agnostic."""
    tools: list[ChatCompletionFunctionToolParam] = []
    for entry in TOOL_REGISTRY.values():
        schema = entry["schema"]
        tools.append(
            ChatCompletionFunctionToolParam(
                type="function",
                function=FunctionDefinition(
                    name=schema["name"],
                    description=schema["description"],
                    parameters=schema["input_schema"],
                ),
            )
        )
    return tools


def _build_context_message(
    feature_summary: FeatureSummary,
    understanding: UnderstandingBundle,
    aesthetic: AestheticBundle,
) -> str:
    return (
        "Here is the complete analysis data (JSON) for this track — complete the task based on this data:\n\n"
        f"feature_summary:\n{json.dumps(asdict(feature_summary), ensure_ascii=False, indent=2)}\n\n"
        f"understanding:\n{json.dumps(asdict(understanding), ensure_ascii=False, indent=2)}\n\n"
        f"aesthetic:\n{json.dumps(asdict(aesthetic), ensure_ascii=False, indent=2)}"
    )


def run_explain(
    audio_id: str,
    language: str,
    feature_summary: FeatureSummary,
    understanding: UnderstandingBundle,
    aesthetic: AestheticBundle,
) -> AnalysisResult:
    language_name = LANGUAGE_NAMES.get(language, LANGUAGE_NAMES["en"])
    labels = DIMENSION_LABELS.get(language, DIMENSION_LABELS["en"])
    dimension_names = ", ".join(f'{dim}="{labels[dim]}"' for dim in DIMENSION_ORDER)
    system_prompt = (
        EXPLAIN_SYSTEM_PROMPT + f"\n\nAlways write summary and explanation in {language_name}. Do not mix languages. "
        f"Refer to each dimension by exactly this name, verbatim, every time it's mentioned: {dimension_names}."
    )

    tools = _openai_tools()
    messages: list[ChatCompletionMessageParam] = [
        ChatCompletionSystemMessageParam(role="system", content=system_prompt),
        ChatCompletionUserMessageParam(role="user", content=_build_context_message(feature_summary, understanding, aesthetic)),
    ]

    tool_call_log: list[ToolCallRecord] = []
    dimension_explanations: dict[str, str] = {}
    dimension_scores: dict[str, float] = {}
    model = os.environ["OPENAI_MODEL"]

    logger.info("[explain] audio_id=%s starting, model=%s", audio_id, model)

    turn = 0
    while True:
        turn += 1
        logger.info("[explain] audio_id=%s turn=%d calling LLM...", audio_id, turn)
        request_start = time.monotonic()
        response = _get_client().chat.completions.create(
            model=model,
            max_tokens=EXPLAIN_MAX_TOKENS,
            tools=tools,
            messages=messages,
        )
        logger.info(
            "[explain] audio_id=%s turn=%d LLM responded in %.1fs, finish_reason=%s",
            audio_id,
            turn,
            time.monotonic() - request_start,
            response.choices[0].finish_reason,
        )
        message = response.choices[0].message
        message_dict = message.model_dump(exclude_none=True)
        # dict[str, Any] from model_dump() is a valid message param — it's the
        # SDK's own message — but the checker can't see that from a dict alone.
        messages.append(cast(ChatCompletionMessageParam, message_dict))
        logger.info(
            "[explain] audio_id=%s turn=%d raw response message:\n%s",
            audio_id,
            turn,
            json.dumps(message_dict, ensure_ascii=False, indent=2),
        )

        if response.choices[0].finish_reason != "tool_calls":
            summary_text = (message.content or "").strip()
            break

        # finish_reason == "tool_calls" guarantees tool_calls is populated, but
        # the two fields are typed independently, so the checker can't see that.
        for tool_call in message.tool_calls or []:
            args = json.loads(tool_call.function.arguments)
            fn = TOOL_REGISTRY[tool_call.function.name]["fn"]

            start = time.monotonic()
            try:
                output = fn(args)
                is_error = False
            except ValueError as exc:
                output = {"error": str(exc)}
                is_error = True
            duration_ms = int((time.monotonic() - start) * 1000)

            logger.info(
                "[explain] audio_id=%s tool_call name=%s dimension=%s ok=%s (%d/%d dimensions so far)",
                audio_id,
                tool_call.function.name,
                args.get("dimension"),
                not is_error,
                len(dimension_explanations) + (0 if is_error else 1),
                len(DIMENSION_ORDER),
            )

            if not is_error:
                tool_call_log.append(ToolCallRecord(tool_name=tool_call.function.name, input=args, output=output, duration_ms=duration_ms))
                dimension_explanations[args["dimension"]] = output["explanation"]
                dimension_scores[args["dimension"]] = float(args["score"])

            messages.append(
                ChatCompletionToolMessageParam(
                    role="tool",
                    tool_call_id=tool_call.id,
                    content=json.dumps(output, ensure_ascii=False),
                )
            )

    logger.info(
        "[explain] audio_id=%s done, verified=%s, tool_call_count=%d",
        audio_id,
        len(dimension_explanations) == len(DIMENSION_ORDER),
        len(tool_call_log),
    )

    explanation = "\n\n".join(
        f"**{labels[dim]} ({dimension_scores[dim]:.0f})**\n{dimension_explanations[dim]}"
        for dim in DIMENSION_ORDER
        if dim in dimension_explanations
    )

    return AnalysisResult(
        audio_id=audio_id,
        verified=len(dimension_explanations) == len(DIMENSION_ORDER),
        tool_call_count=len(tool_call_log),
        tool_call_log=tool_call_log,
        aesthetic=aesthetic,
        understanding=understanding,
        feature_summary=feature_summary,
        summary=summary_text,
        explanation=explanation,
        explanation_skipped=False,
    )


def _build_chat_context_message(
    feature_summary: FeatureSummary,
    understanding: UnderstandingBundle,
    aesthetic: AestheticBundle,
    summary: str,
    explanation: str,
) -> str:
    return (
        _build_context_message(feature_summary, understanding, aesthetic)
        + "\n\nHere are the conclusions already generated for this data — when answering the "
        "follow-up question, you may only reference the information in this data:\n\n"
        + f"summary:\n{summary}\n\n"
        + f"explanation:\n{explanation}"
    )


def run_chat(
    audio_id: str,
    question: str,
    language: str,
    feature_summary: FeatureSummary,
    understanding: UnderstandingBundle,
    aesthetic: AestheticBundle,
    summary: str,
    explanation: str,
) -> str:
    language_name = LANGUAGE_NAMES.get(language, LANGUAGE_NAMES["en"])
    system_prompt = CHAT_SYSTEM_PROMPT + f"\n\nAlways answer in {language_name}. Do not mix languages."

    messages: list[ChatCompletionMessageParam] = [
        ChatCompletionSystemMessageParam(role="system", content=system_prompt),
        ChatCompletionUserMessageParam(
            role="user",
            content=_build_chat_context_message(feature_summary, understanding, aesthetic, summary, explanation),
        ),
        ChatCompletionUserMessageParam(role="user", content=question),
    ]

    logger.info("[chat] audio_id=%s language=%s calling LLM...", audio_id, language)
    request_start = time.monotonic()
    response = _get_client().chat.completions.create(
        model=os.environ["OPENAI_MODEL"],
        max_tokens=CHAT_MAX_TOKENS,
        messages=messages,
    )
    logger.info("[chat] audio_id=%s LLM responded in %.1fs", audio_id, time.monotonic() - request_start)
    message = response.choices[0].message
    return (message.content or "").strip()
