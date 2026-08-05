# CLAUDE.md — Computable Beauty

每次新会话开始，先读 `doc/ai-context.md`，再开始工作。

---

## 关键约束

- **禁止裸 dict**：层间传输只用 `contracts/` 里定义的类型，不用 `dict`
- **L4 永远调真实 Claude API**：即使其他层用 Mock，Harness Orchestrator 也必须调真实 API
- **结论只能引用工具返回值**：Claude 在 Harness tool use 循环里不得自行推断数据，所有数字必须来自工具输出
- **SKILL 只用于 Claude 工具**：L1-L3 是普通 Python 模块，只有 `explain-dimension` 等 L4 Claude 工具才走 `SKILL.md` → `apps/engine/skills/[skill_name].py` → `registry.py` 三件套
- **Mock → 真实只改注册表**：换掉 Mock 实现时，只改 `registry.py` 对应条目，Orchestrator 代码不动

## 禁止行为

- 给 L1-L3 模块写 SKILL.md（它们是普通模块，接口由 contracts/types.py 约束）
- 未写 `SKILL.md` 就开始写 L4 Claude 工具实现代码
- 直接修改 `apps/engine/registry.py` 而不先更新对应 `SKILL.md`
- 在 `contracts/` 类型之外新造传输格式
- 让 `FeatureBundle`（含 numpy array）跨服务传输

---

## 项目当前进度

**所处阶段：Stage 0 — 合约定义与框架搭建（进行中）**

已完成的部分：

- **Part 1 合约定义**：`contracts/types.py / .go / .ts` 三语言类型文件完成，字段名和 JSON key 全部对齐，经过多轮一致性检查
- **Mock 数据**：三个 fixtures 文件完成并对齐——`apps/engine/mock/fixtures.py`、`apps/gateway/mock/fixtures.go`、`apps/web/mock/fixtures.ts`，数据和文本内容完全一致
- **文档体系**：`doc/architecture.md`、`doc/product.md`、`doc/contracts.md`、`doc/roadmap.md`、`doc/ai-context.md`、`doc/purpose.md` 全部完成，经过多轮跨文件一致性校对
- **SKILL 模板**：`skills/_template/SKILL.md` 完成，明确 L4-only 范围、实现路径、注册表格式
- **学习文章**：`articles/01-field-glossary.md` 完成，覆盖项目所有专业字段的技术原理

待实现（Part 2–5）：

- `apps/engine/` FastAPI 骨架（Mock 端点）
- `apps/gateway/` Golang 骨架（SSE + 任务分发）
- `apps/web/` Next.js 骨架（`create-next-app` + Route Handlers + 静态 Props 组件）
- L4 Harness 骨架（接真实 Claude，工具返回 Mock 数据）

---

## 用户工作偏好

- **不复杂化**：方案讨论后如果觉得超出必要范围，会直接撤销。曾撤销 JWT 匿名用户系统，理由是"先顺利跑起来"
- **命名统一**：不容忍同一概念多个叫法。曾把 `job_id` 统一改成 `id`，理由是"统一 id 就可以复用"
- **一致性优先**：每次大改后主动做跨文件检查（contracts/ vs fixtures/ vs doc/）。习惯在推进之前先把文档和合约做对齐
- **对照代码学习**：倾向于通过阅读实际代码和字段理解技术，articles/ 就是为了这个目的
- **直接执行**：给出选项后快速决策（如"选方案2"），不需要反复确认
- **事实来源明确**：接受"某个文件是唯一权威"的约定（`product.md` 是 UI 唯一事实来源），修改时按权威文件对齐其他文件，不反向

---

## 执行边界

- **不执行本项目文件之外的命令**：只做方案设计和写代码/配置文件，不主动运行 `docker`、启动服务、跑数据库迁移等会改动本项目文件系统之外状态（容器、进程、外部服务）的命令
- 验证、启动、联调由用户自己在本地执行，Claude 负责把命令给全（可直接复制运行）
- 允许的操作：读文件、写/改本项目内的文件、`git diff`/`git status` 等只读检查
- 如果不确定某个命令算不算“操作本项目文件之外”，先问，不要默认执行
