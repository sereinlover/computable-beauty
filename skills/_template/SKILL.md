# Skill: skill-name

> 复制此模板到 `skills/[skill-name]/SKILL.md`，填写各项后再写实现代码。
> SKILL 只用于 L4 Claude 工具。L1-L3 是普通 Python 模块，不需要此文件。

**层**：L4　　**Stage**：N

---

## 职责

一句话描述这个 Skill 做什么。

---

## 输入 Schema

```json
{
  "required_field": "type — 说明",
  "optional_field": "type? — 可选，说明"
}
```

## 输出 Schema

```json
{
  "field_name": "type — 说明"
}
```

---

## 注册表条目

在 `apps/engine/registry.py` 中添加：

```python
from skills.skill_name import skill_function  # apps/engine/skills/skill_name.py

SKILL_REGISTRY["skill-name"] = {
    "fn": skill_function,          # 替换为真实实现时只改这一行
    "schema": {
        "name": "skill-name",
        "description": "一句话",
        "input_schema": {
            "type": "object",
            "properties": {
                "field_name": {"type": "string", "description": "..."}
            },
            "required": ["field_name"]
        }
    }
}
```

---

## 验证清单

每次实现变更后逐项检查：

- [ ] 输出字段与 schema 完全一致（无多余字段、无缺失字段）
- [ ] 关键数值在合理范围内（如 BPM 在 40–220、score 在 0–100）
- [ ] 运行 `apps/engine/tests/test_[skill_name].py` 全部通过
- [ ] 边界情况：空文件 / 超短音频 / 异常格式有明确错误返回

---

## 已知限制

- 列出当前版本不支持的场景

---

## 实现位置

```
skills/[skill-name]/SKILL.md              # 本文件（契约文档）
apps/engine/skills/[skill_name].py        # 实现函数（snake_case 文件名）
apps/engine/registry.py                   # 注册表条目（挂载入口）
apps/engine/tests/test_[skill_name].py    # 单元测试
```
