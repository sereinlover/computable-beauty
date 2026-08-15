"""TOOL_REGISTRY — registry of all LLM-callable tools; see harness/tools/{name}/TOOL.md for each tool's contract."""

from harness.tools.explain_dimension import explain_dimension


def _explain_dimension_entry() -> dict:
    return {
        "fn": explain_dimension,
        "schema": {
            "name": "explain_dimension",
            "description": "Submit an evidence-based natural-language explanation for one aesthetic dimension",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dimension": {
                        "type": "string",
                        "enum": [
                            "physical_precision",
                            "structural_logic",
                            "emotional_depth",
                            "vital_tension",
                        ],
                        "description": "The aesthetic dimension's English name",
                    },
                    "score": {"type": "number", "description": "That dimension's score, 0-100"},
                    "evidence": {"type": "object", "description": "That dimension's evidence value dict"},
                    "explanation": {
                        "type": "string",
                        "description": "Natural-language explanation, must cite concrete values from evidence, must not invent numbers",
                    },
                },
                "required": ["dimension", "score", "evidence", "explanation"],
            },
        },
    }


TOOL_REGISTRY: dict[str, dict] = {
    "explain_dimension": _explain_dimension_entry(),
}
