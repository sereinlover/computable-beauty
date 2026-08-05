# AI Context — Computable Beauty

每次新会话开始前先读这个文件。系统完整设计见 `doc/architecture.md`。

---

## 当前开发阶段

**Stage 0 — 合约定义与骨架搭建（进行中）**

| 模块 | 状态 |
|------|------|
| `contracts/` 三语言类型 | ✅ 完成 |
| `apps/engine/mock/fixtures.py` Mock 数据 | ✅ 完成 |
| `apps/engine/` FastAPI 骨架 | 🔲 待实现 |
| `apps/gateway/` Golang 骨架 | 🔲 待实现 |
| `apps/web/` Next.js 骨架 | 🔲 待初始化（需 `create-next-app`） |

验收：`docker-compose up` 拉起三服务 → 上传音频 → SSE 进度正常 → 结果页渲染 Mock 数据 → AI 解读是 Claude 真实生成。

---

## 容易搞错的规则

- `numpy` arrays **不跨服务**：只在 `apps/engine/` 内部流转，wire types 里没有 numpy
- Engine 接口是内网接口：只供 Gateway 调，**浏览器不可直接访问**
- **L1-L3 不是 Claude tool**：Gateway 顺序调用 `/internal/extract-features` → `/internal/classify` → `/internal/score-aesthetics` 完成确定性计算，不经过 Claude；只有 `/internal/explain` 才启动 Harness，Claude 在里面调 `explain_dimension × 4`
- **L4 Harness 永远调真实 Claude**，即使工具返回 Mock 数据
- SKILL 只用于 L4 Claude 工具（`explain-dimension` 等），L1-L3 是普通 Python 模块；SKILL 开发顺序：`SKILL.md` → 实现函数 → 注册表条目
- 换 Mock 为真实实现：**只改注册表条目，Orchestrator 代码不动**
- **POST /api/jobs 返回 `{id, status}`**：`status="done"` 表示缓存命中，直接 GET 结果跳过 SSE；`status="pending"` 才建立 SSE 连接等待计算完成
- **PG 两张表**：`analyses`（`audio_id` 主键，存 `result`，同文件只有一行）+ `jobs`（每次上传一行，存状态和耗时）；写入顺序：先写 PG，再写 Redis，`status="done"` 信号放最后

---

## API 速查

**Browser → Next.js Route Handlers**

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/analyze` | 音频上传，转发给 Gateway |
| GET | `/api/progress?job_id=xxx` | SSE 透传（代理 Gateway GET /api/jobs/{id}/stream） |
| GET | `/api/result/:job_id` | 查询结果（代理 Gateway GET /api/jobs/{id}） |
| POST | `/api/chat/:job_id` | 追问（代理 Gateway POST /api/jobs/{id}/chat） |
| GET | `/api/history` | 历史记录列表（代理 Gateway GET /api/history） |
| GET | `/api/demo-tracks` | Demo 曲目列表（代理 Gateway GET /api/demo-tracks） |

**Gateway → Engine（内网）**

| Method | Path | 返回 |
|--------|------|------|
| POST | `/internal/extract-features` | `FeatureSummary` |
| POST | `/internal/classify` | `UnderstandingBundle` |
| POST | `/internal/score-aesthetics` | `AestheticBundle` |
| POST | `/internal/explain` | `AnalysisResult` |
| POST | `/internal/chat` | `{ answer, conversation_context_id }` |

**Next.js → Golang Gateway（Gateway 对外接口）**

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/jobs` | 提交任务 → `{id, status}` |
| GET | `/api/jobs/{id}` | 查询结果 |
| GET | `/api/jobs/{id}/stream` | SSE 进度流 |
| POST | `/api/jobs/{id}/chat` | 追问 |
| GET | `/api/history` | 历史记录列表 |
| GET | `/api/demo-tracks` | Demo 曲目列表 |

SSE steps：`特征提取(20%)` → `情感分类(55%)` → `美学评分(85%)` → `AI解读(95%)` → `event:done`

---

## 唯一事实来源：`doc/product.md`

**`doc/product.md` 是整个项目的唯一 UI 事实来源。**

- 页面组件结构、字段取值、数值显示规则，以 `product.md` 为准
- 四维美学定义（evidence 字段列表）、Harness 工具链顺序，以 `product.md` 为准
- 所有其他文件（`contracts/`、`doc/contracts.md`、`fixtures`、`roadmap.md`）向 `product.md` 对齐
- **禁止反向**：不得因为实现上的便利去修改 `product.md` 的规格

当 `product.md` 与其他文件有冲突时，**以 `product.md` 为准**，修改其他文件。

---

## 文档索引

| 需要了解 | 读哪里 |
|---------|--------|
| **UI 组件结构、字段定义、数值显示规则（事实来源）** | **`doc/product.md`** |
| 项目背景、目标岗位、交付物、优先级判断 | `doc/purpose.md` |
| 完整架构（层、服务、SKILL 模式、设计规则） | `doc/architecture.md` |
| 层间 HTTP 接口完整 request/response 规格 | `doc/contracts.md` |
| 各阶段目标、实现要点、代码参考、验收标准 | `doc/roadmap.md` |
| `apps/web` 分关卡初始化步骤（Next.js + Tailwind + shadcn/ui） | `doc/web-init.md` |
| 层间类型定义 | `contracts/types.py / .go / .ts` |
| SKILL 规范格式 | `skills/_template/SKILL.md` |
| Mock 数据结构 | `apps/engine/mock/fixtures.py` |
| 服务启动配置 | `docker-compose.yml` |
