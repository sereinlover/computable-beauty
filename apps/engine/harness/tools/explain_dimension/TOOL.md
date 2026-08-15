# Tool: explain_dimension

**Layer**: L4

> **This file is never read or parsed by any code at runtime.** It's a design contract for humans (and AI assistants) to read, not a config file — the schema in `apps/engine/harness/registry.py` was hand-copied from here, and there's no automatic sync between the two. When the schema changes, update this doc first, then `registry.py`; consistency is maintained by process convention, not enforced by tooling.

---

## Responsibility

In the Harness Orchestrator's tool-use loop, the LLM submits a well-evidenced natural-language explanation for one aesthetic dimension. `explanation` is written by the LLM and passed in as an argument — this Tool doesn't generate text, it only does structural validation and recording. The actual "call a real LLM" step happens in the Orchestrator's LLM API call (`apps/engine/harness/orchestrator.py`), not inside this function.

Called once per dimension per analysis, for all four dimensions (`physical_precision`/`structural_logic`/`emotional_depth`/`vital_tension`) — 4 calls total.

---

## Input Schema

```json
{
  "dimension": "string — the dimension's English name, must be one of the four valid values",
  "score": "number — that dimension's score, 0-100, from L3's AestheticBundle",
  "evidence": "object — that dimension's evidence value dict (key: feature name, value: number), from L3's AestheticBundle",
  "explanation": "string — natural-language explanation written by the LLM, must cite concrete values from evidence, must not invent numbers outside the given context"
}
```

## Output Schema

```json
{
  "explanation": "string — returned unchanged after validation passes, for the Orchestrator to assemble into AnalysisResult.explanation"
}
```

On validation failure, raises `ValueError`, which the Orchestrator catches and turns into a tool-error result fed back to the LLM (not a direct 500 for the whole request — the LLM gets a chance to call again).

---

## Registry Entry

Add to `apps/engine/harness/registry.py`:

```python
from harness.tools.explain_dimension import explain_dimension  # apps/engine/harness/tools/explain_dimension/explain_dimension.py


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
                        "enum": ["physical_precision", "structural_logic", "emotional_depth", "vital_tension"],
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


TOOL_REGISTRY["explain_dimension"] = _explain_dimension_entry()
```

---

## Verification Checklist

Check each item after every implementation change:

- [ ] Raises `ValueError` when `dimension` isn't one of the four valid values
- [ ] Raises `ValueError` when `score` is outside 0-100
- [ ] Raises `ValueError` when `evidence` is missing, empty, or not an object
- [ ] Raises `ValueError` when `explanation` is an empty string
- [ ] Returns `{"explanation": ...}` unchanged on valid input, no text rewriting
- [ ] `apps/engine/tests/test_explain_dimension.py` passes in full

---

## Known Limitations

- No deep semantic validation of "do the numbers in `explanation` actually match the values in `evidence`" — this relies on the system prompt in `harness/system_prompt.py` constraining the LLM not to invent numbers ("values may only cite what's already in the given context"). If the LLM is later found to occasionally fabricate numbers, a stricter check (extract numbers + compare) could be added here
- No duplicate-call guard (calling the same `dimension` twice is still accepted) — the Orchestrator instead checks the set of `dimension`s already seen in `tool_call_log` to determine whether all four dimensions have been called

---

## Implementation Location

```
apps/engine/harness/tools/explain_dimension/TOOL.md              # this file (contract doc)
apps/engine/harness/tools/explain_dimension/explain_dimension.py # implementation function
apps/engine/harness/registry.py                                  # registry entry (mount point)
apps/engine/tests/test_explain_dimension.py                      # unit tests
```
