"""Implementation for the `explain_dimension` L4 tool — see harness/tools/explain_dimension/TOOL.md."""

import logging

logger = logging.getLogger(__name__)

VALID_DIMENSIONS = {"physical_precision", "structural_logic", "emotional_depth", "vital_tension"}


def explain_dimension(args: dict) -> dict:
    dimension = args["dimension"]
    score = args["score"]
    evidence = args["evidence"]
    explanation = args["explanation"]

    logger.info(
        "[tool] explain_dimension called: dimension=%s score=%s evidence=%s explanation_len=%d",
        dimension,
        score,
        evidence,
        len(explanation),
    )

    if dimension not in VALID_DIMENSIONS:
        logger.warning("[tool] explain_dimension rejected: invalid dimension=%r", dimension)
        raise ValueError(f"invalid dimension: {dimension!r}")
    if not (0 <= score <= 100):
        logger.warning("[tool] explain_dimension rejected: score out of range=%r", score)
        raise ValueError(f"score out of range: {score!r}")
    if not isinstance(evidence, dict) or not evidence:
        logger.warning("[tool] explain_dimension rejected: evidence is empty or not an object")
        raise ValueError("evidence must be a non-empty object")
    if not explanation.strip():
        logger.warning("[tool] explain_dimension rejected: explanation is empty")
        raise ValueError("explanation is empty")

    logger.info("[tool] explain_dimension accepted: dimension=%s", dimension)
    return {"explanation": explanation}
