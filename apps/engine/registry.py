"""
SKILL_REGISTRY — 所有可调用 Skill 的注册表。

每个条目结构：
{
    "fn":     callable,          # 实际执行函数，签名见对应 skills/{name}/SKILL.md
    "schema": {                  # 传给 Claude tool use 的 JSON Schema
        "name":         str,
        "description":  str,
        "input_schema": {"type": "object", "properties": {...}, "required": [...]}
    }
}

开发规则：
- 先写 skills/{name}/SKILL.md，再写实现，最后在此注册
- Mock 阶段：fn 指向 mock 函数；替换真实实现时只改 fn，schema 不动
"""

SKILL_REGISTRY: dict[str, dict] = {}
