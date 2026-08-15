# Tool: tool_name

> Copy this template to `harness/tools/[tool_name]/TOOL.md`, fill in every section, then write the implementation.
> TOOL.md is only for L4 LLM tools. L1-L3 are plain Python modules and don't need this file.

**Layer**: L4

---

## Responsibility

One sentence describing what this Tool does.

---

## Input Schema

```json
{
  "required_field": "type — description",
  "optional_field": "type? — optional, description"
}
```

## Output Schema

```json
{
  "field_name": "type — description"
}
```

---

## Registry Entry

Add to `apps/engine/harness/registry.py`:

```python
from harness.tools.tool_name import tool_function  # apps/engine/harness/tools/tool_name/tool_name.py


def _tool_name_entry() -> dict:
    return {
        "fn": tool_function,  # only this line changes when swapping in the real implementation
        "schema": {
            "name": "tool_name",
            "description": "one sentence",
            "input_schema": {
                "type": "object",
                "properties": {"field_name": {"type": "string", "description": "..."}},
                "required": ["field_name"],
            },
        },
    }


TOOL_REGISTRY["tool_name"] = _tool_name_entry()
```

---

## Verification Checklist

Check each item after every implementation change:

- [ ] Output fields exactly match the schema (no extra fields, none missing)
- [ ] Key values fall within a reasonable range (e.g. BPM 40–220, score 0–100)
- [ ] `apps/engine/tests/test_[tool_name].py` passes in full
- [ ] Edge cases: empty file / ultra-short audio / malformed format return a clear error

---

## Known Limitations

- List scenarios the current version doesn't support

---

## Implementation Location

```
apps/engine/harness/tools/[tool_name]/TOOL.md               # this file (contract doc)
apps/engine/harness/tools/[tool_name]/[tool_name].py        # implementation function (snake_case filename)
apps/engine/harness/registry.py                             # registry entry (mount point)
apps/engine/tests/test_[tool_name].py                       # unit tests
```
