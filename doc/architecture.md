# Architecture Spec — Computable Beauty

> 给 AI 编程助手的上下文文档。涉及服务间调用、新增接口、技术选型时请先阅读此文件。

音乐美学分析系统。核心命题：音乐的"美"是否可以被计算？
Portfolio 项目，面向 MIR 算法工程岗位。

---

## 目录结构

```
computable-beauty/
├── apps/
│   ├── engine/       # FastAPI — Python AI 计算（L1–L4）
│   ├── gateway/      # Golang — 任务队列、缓存、结果聚合
│   └── web/          # Next.js — UI + BFF Route Handlers
├── contracts/        # 层间类型定义（三语言同步）
│   ├── types.py      # Python internal（含 numpy，引擎内部用）
│   ├── types.go      # Golang wire types（跨服务 JSON）
│   └── types.ts      # TypeScript wire types（前端用）
├── skills/           # SKILL 注册表
│   └── _template/SKILL.md
├── doc/
│   ├── ai-context.md     # 每次会话入口（当前 Stage、速查）
│   ├── architecture.md   # 本文件：完整架构参考
│   ├── contracts.md      # 层间 HTTP 接口完整 request/response 规格
│   ├── product.md        # 产品 UI 与评分规格
│   ├── purpose.md        # 项目背景、目标岗位、交付物
│   └── roadmap.md        # 各阶段目标、实现要点、验收标准
└── docker-compose.yml
```

---

## 服务总览

```
浏览器
  │ HTTP / SSE
  ▼
Next.js 16 (apps/web, :3000)       ← 前端渲染 + BFF Route Handlers
  │ HTTP（内网）
  ▼
Golang (apps/gateway, :8080)       ← 工程层：任务调度、ONNX 推理、Redis 缓存、结果聚合
  │ HTTP（内网）
  ├── PostgreSQL (:5432)            ← 历史记录、分析结果持久化（Gateway 写入）
  └── Redis (:6379)                 ← 任务状态、结果缓存（Gateway 管理）
  │
  ▼
FastAPI (apps/engine, :8000)       ← Python AI 计算：librosa、PyTorch、scipy
```

---

## 各服务职责边界

### Next.js（apps/web）

**只做：**
- 页面路由与渲染（App Router）
- 接收浏览器文件上传，转发给 Golang
- SSE 进度事件代理（把 Golang 的状态推给浏览器）
- 调用 Golang 的结果接口，返回给前端

**不做：**
- 任何 AI 计算
- 直接调用 FastAPI（必须经过 Golang）
- 业务逻辑（只做转发和渲染）

**接口（Route Handlers，代理到 Gateway）：**

```
POST /api/analyze                 接收音频上传，转发给 Gateway POST /api/jobs
GET  /api/result/:job_id          查询结果（代理 Gateway GET /api/jobs/{id}）
GET  /api/progress?job_id=xxx     SSE 透传（代理 Gateway GET /api/jobs/{id}/stream）
POST /api/chat/:job_id            追问（代理 Gateway POST /api/jobs/{id}/chat）
GET  /api/history                 历史记录列表（代理 Gateway GET /api/history）
GET  /api/demo-tracks             Demo 曲目列表（代理 Gateway GET /api/demo-tracks）
```

### Golang（apps/gateway）

**只做：**
- 任务队列与并发控制（goroutine + channel）
- 调用 FastAPI 触发 Python 计算
- ONNX Runtime 推理（见下方「ONNX 推理分工」）
- Redis 缓存（audio_id 命中则直接返回，跳过 pipeline）
- 把多个子任务结果聚合成完整 AnalysisResult JSON
- 向 Next.js 推送任务进度（SSE）
- 文件存储（接收上传文件，本地或 S3）

#### ONNX 推理分工

并非所有模型都在 Golang 里跑，只有**延迟敏感的单任务轻量模型**才导出到 ONNX：

| 模型 | 推理位置 | 理由 |
|------|---------|------|
| 流派分类器（`genre-classifier`） | Golang ONNX Runtime | 单任务、输入固定、延迟敏感 |
| 情感分类器（`emotion-classifier`） | FastAPI | 需要 Python 特征预处理 |
| 乐器分类器（`instrument-classifier`） | FastAPI | 多标签、依赖 torch 生态 |
| 情感弧线（`emotion-arc-modeler`） | FastAPI | 滑窗循环调用，留在 Python 更干净 |

**导出流程：**

```
# apps/engine/scripts/export_onnx.py
torch.onnx.export(model, dummy_input, "models/onnx/genre_classifier.onnx")
```

导出产物放 `apps/gateway/models/onnx/`，Gateway 启动时加载。Go 侧使用 `github.com/yalue/onnxruntime_go`。

当 Golang 本地能推理时，跳过对 FastAPI `/internal/classify` 的调用，直接返回结果给聚合层。

**不做：**
- 页面渲染
- librosa / PyTorch 等 Python-only 计算
- 直接响应浏览器（只处理来自 Next.js 的内部请求）

**接口（对 Next.js 暴露）：**

```
POST /api/jobs                    提交分析任务 → { id, status }
GET  /api/jobs/{id}               查询任务结果
GET  /api/jobs/{id}/stream        SSE 进度推送
POST /api/jobs/{id}/chat          追问（转发给 /internal/chat）
GET  /api/history                 历史记录列表
GET  /api/demo-tracks             内置 Demo 曲目列表
```

### FastAPI（apps/engine）

**只做：**
- Python AI 计算：librosa 特征提取（含节拍追踪）、PyTorch 推理、scipy 评分
- Skill 函数的实际执行
- 调用 Claude API（L4 Harness Orchestrator）
- 模型训练脚本（离线，不在请求链路上）

**不做：**
- 任务调度
- 缓存
- 直接响应浏览器或 Next.js

**接口（内网，仅供 Gateway 调用）：**

`audio_path` 指向 Gateway 已存好的文件（共享卷 `/data/uploads/`）。

```
POST /internal/extract-features   { audio_id, audio_path }                                          → FeatureSummary
POST /internal/classify           { audio_id, audio_path, feature_summary }                         → UnderstandingBundle
POST /internal/score-aesthetics   { audio_id, audio_path, feature_summary, understanding }          → AestheticBundle
POST /internal/explain            { audio_id, audio_path, job_id, feature_summary, understanding, aesthetic } → AnalysisResult
POST /internal/chat               { question, conversation_context_id }                             → { answer, conversation_context_id }
```

---

## 技术栈

| 服务 | 语言          | 框架/版本 | 部署 |
|------|-------------|----------|------|
| web | TypeScript  | Next.js 16 App Router | Vercel |
| gateway | Go 1.26 | net/http + chi | Docker |
| engine | Python 3.12 | FastAPI + uvicorn | Docker |
| 数据库 | —           | PostgreSQL 16 | Docker |
| 缓存 | —           | Redis 7 | Docker |

---

## 端口约定（本地开发）

| 服务 | 端口 |
|------|------|
| Next.js | 3000 |
| Golang gateway | 8080 |
| FastAPI engine | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## 五层 Pipeline

音频文件从下往上流经五层，layer boundary 类型全部定义在 `contracts/`，**禁止在层间使用裸 dict**：

| Layer | 名称 | 职责 | 输出类型 |
|-------|------|------|---------|
| L1 | 特征层 | 信号处理：MFCC、mel 谱、chroma、BPM、调性、动态 | `FeatureBundle` |
| L2 | 理解层 | MIR 分类：流派、情感弧线、乐器、结构分段、和弦 | `UnderstandingBundle` |
| L3 | 评估层 | 美学评分：四个维度分数 + 综合指数 | `AestheticBundle` |
| L4 | 智能体层 | Harness Orchestrator：工具调用循环、证据链、自然语言解读 | `AnalysisResult` |
| L5 | 应用层 | Web UI + 部署 | HTTP / SSE 响应 |

---

## 各层子模块

### L1 特征层

| 模块 | 职责 | 主要技术 |
|------|------|----------|
| `AudioLoader` | 加载、重采样、单声道化、归一化 | `librosa.load`、`soundfile` |
| `SpectralExtractor` | 提取频谱类特征 | `librosa`（MFCC、mel 谱、chroma、谱质心） |
| `TemporalExtractor` | 提取节拍/节奏类特征 | `librosa.beat.beat_track` |
| `HarmonicExtractor` | 提取调性/和声类特征 | `librosa.effects.harmonic`、chroma 模板匹配 |
| `DynamicExtractor` | 提取动态/响度类特征 | `librosa.feature.rms`、静音检测 |
| `FeatureAggregator` | 时序特征聚合成 clip 级统计量 | numpy（均值、方差、分位数） |

**关键设计点：**
- 所有时序特征统一以 `hop_length=512, sr=22050` 为基准，确保帧对齐
- `FeatureAggregator` 同时保留**时序版本**（供 L2 情感弧线建模）和**统计量版本**（供 L3 评分）
- `AudioLoader` 处理格式差异，L2 以上只看归一化后的 numpy array

### L2 理解层

| 模块 | 职责 | 输入特征 | 技术选型 |
|------|------|----------|----------|
| `GenreClassifier` | 流派识别 | `mel_spectrogram` | CNN（GTZAN 微调）；备选：CLAP 零样本 |
| `EmotionClassifier` | 片段级情感分类 | `mfcc`、`chroma`、`rms`、`bpm` | MLP 或轻量 Transformer，多标签 |
| `EmotionArcModeler` | 帧级情感弧线 | `mfcc`（时序）、`rms`（时序） | 滑动窗口调用 EmotionClassifier |
| `InstrumentClassifier` | 乐器识别 | `mel_spectrogram` | 多标签 CNN；备选：Essentia |
| `StructureSegmenter` | 乐段结构切割 | `chroma`、`mfcc` | 自相似矩阵（SSM）+ 谱聚类；备选：MSAF |
| `ChordRecognizer` | 和弦进行识别 | `chroma`（时序） | 模板匹配（主要三和弦/七和弦）；备选：深度模型 |

**关键设计点：**
- `GenreClassifier` 和 `InstrumentClassifier` 优先预训练模型微调（CLAP、Essentia），降低冷启动成本
- `EmotionClassifier` 是**项目中唯一需要从头训练的核心模型**，训练数据来自 MER 数据集或自标注
- `EmotionArcModeler` 不是独立模型，是对 `EmotionClassifier` 的滑窗调用包装
- `ChordRecognizer` 先用模板匹配建立 baseline，后续可换深度模型

### L3 评估层

| 模块 | 职责 | 关键输入 | 计算逻辑 |
|------|------|----------|----------|
| `PhysicalPrecisionScorer` | 物理精确性评分 | `tempo_stability`、`spectral_entropy`、`dynamic_range_db` | 各指标归一化后加权求和 |
| `StructuralLogicScorer` | 结构逻辑评分 | `chords`（T-S-D 覆盖）、`structure`（段落比例）、`key` | 规则打分 + 统计量 |
| `EmotionalDepthScorer` | 情感深度评分 | `emotion_arc`（valence/arousal 时序） | 峰谷落差、极性转折次数、弧线标准差 |
| `VitalTensionScorer` | 生命张力评分 | `rms`（时序）、`onset_strength`、不协和和弦比例 | 动态对比度、能量突变频率、静音-爆发比 |
| `AestheticAggregator` | 综合指数计算 | 四维分数 | 加权求和，权重可配置 |

**关键设计点：**
- 每个 Scorer 必须输出 **`evidence` 字段**（供 L4 Agent 引用），不只是分数
- L3 整体是**确定性计算**：相同输入 → 相同输出，不涉及模型推理
- `AestheticAggregator` 权重作为可配置参数暴露，便于对比不同方案

### L4 智能体层

| 模块 | 职责 | 技术 |
|------|------|------|
| `HarnessOrchestrator` | 主编排循环，按序调用工具，汇总证据生成结论 | Claude API tool use 模式 |
| `ToolRegistry` | 注册所有可调用工具，定义 JSON Schema | Python dict |
| `EvidenceTracker` | 记录每次工具调用的输入输出，构建证据链 | 内存中的 call log list |
| `ConversationHandler` | 处理追问，基于已有调用结果回答，不重复计算 | Claude API with context |

**L1-L3 是确定性计算，由 Gateway 在调用 /internal/explain 前顺序完成，不经过 Claude。**

**Claude 可调用的工具仅限解释类：**

```python
tools = [
    {
        "name": "explain_dimension",
        "description": "针对某个美学维度，基于已有 evidence 生成自然语言解释",
        "input_schema": {
            "type": "object",
            "properties": {
                "dimension": {"type": "string"},
                "score":     {"type": "number"},
                "evidence":  {"type": "object"}
            },
            "required": ["dimension", "score", "evidence"]
        },
        "output_schema": {"explanation": "str"}
    },
    {
        "name": "compare_segments",
        "description": "对比曲中两个结构段落的特征差异",
        "input_schema": {"segment_a": "Segment", "segment_b": "Segment"},
        "output_schema": "dict"
    }
]
```

**Harness 执行流程：**

```
Gateway 顺序调用（确定性，无 Claude 参与）：
  POST /internal/extract-features → FeatureSummary
  POST /internal/classify         → UnderstandingBundle
  POST /internal/score-aesthetics → AestheticBundle

POST /internal/explain 接收以上三层结果后启动 Claude Harness：
  Claude 接收 feature_summary / understanding / aesthetic 作为上下文
  1. explain_dimension(physical_precision, 84, evidence) → 物理精确性解释
  2. explain_dimension(structural_logic,   78, evidence) → 结构逻辑解释
  3. explain_dimension(emotional_depth,    88, evidence) → 情感深度解释
  4. explain_dimension(vital_tension,      91, evidence) → 生命张力解释
  5. compare_segments(segment_a, segment_b)              → 段落对比
```

**结论只能引用上下文中已有的数值，不得自行推断数据。**

---

## 合约类型

见 `contracts/types.py / types.go / types.ts`。

关键规则：**numpy arrays（mfcc、mel_spectrogram 等）留在 engine 内部，不跨服务序列化。**
跨服务传输的只有标量和结构化列表（emotion_arc、structure、chords 等）。

`audio_id` 是所有 Bundle 的关联键，贯穿 L1–L4。

---

## 关键数据流

### 上传分析请求

```
1. 浏览器 POST /api/analyze（multipart，音频文件）
2. Next.js Route Handler 以 multipart 透传给 Gateway POST /api/jobs
3. Gateway 将文件存入共享卷 /data/uploads/{sha256}.ext，计算内容 SHA-256 作为 audio_id
4. Gateway 始终创建新 job（UUID）
5. Gateway 检查 Redis 缓存（audio_id）：
   - 命中：把缓存结果写入该 job，标记 status="done"，返回 { job_id, status: "done" }
   - 未命中：推入 worker 队列，返回 { job_id, status: "pending" }
6. Next.js 返回浏览器 { job_id, status }

浏览器根据 status 分支处理：

分支 A — status == "done"（缓存命中，结果已就绪）：
7. 浏览器直接 GET /api/result/:job_id，跳过 SSE

分支 B — status == "pending"（需要计算）：
7. 浏览器建立 SSE 长连接 GET /api/progress?job_id=xxx
   Next.js 代理 Golang GET /api/jobs/{id}/stream，透传 SSE events 给浏览器
8. Golang worker 依次调用 FastAPI 子任务，每完成一个阶段更新 Redis job 状态
9. 全部完成后推送 event: done

获取结果（分支 A 直接到此，分支 B 收到 event:done 后到此）：
10. 浏览器 GET /api/result/:job_id
11. Next.js GET http://gateway:8080/api/jobs/{id}
12. Golang 从 Redis / PG 取完整 AnalysisResult 返回

失败路径（L1-L4 任意步骤返回错误）：
8e. Golang 标记 job status="failed"，写入 error 字段
    若 SSE 连接仍在 → 推 event:error + 错误信息
    浏览器关闭 SSE，显示错误信息 + "重新上传" 按钮
    重试 = 重新 POST /api/analyze，产生新 job_id（不支持断点续传）
```

### SSE 事件格式

```
data: {"step":"extracting_features","message":"正在提取音频特征...","progress":0.20}

data: {"step":"classifying","message":"正在分类流派与情感...","progress":0.55}

data: {"step":"scoring","message":"正在计算美学评分...","progress":0.85}

data: {"step":"explaining","message":"Claude 正在生成分析...","progress":0.95}

event: done
data: {"step":"done","progress":1.0}

event: error
data: {"step":"failed","message":"分析失败，请重试"}
```

---

## 数据存储

**原则：Redis 是加速层，PostgreSQL 是事实来源。** Redis 数据丢失不影响功能（最多重新计算），PostgreSQL 是用户历史的唯一持久存储。

### PostgreSQL

两张表，按职责分离：`analyses` 存音频内容的分析结果（按 audio_id 去重），`jobs` 存每次上传请求的状态记录。同一文件多次上传产生多个 job，但 `result` 只存一份。

```sql
-- 音频分析结果，内容寻址，一个 audio_id 只有一行
CREATE TABLE analyses (
    audio_id              CHAR(64)     PRIMARY KEY, -- 文件内容 SHA-256
    result                JSONB        NOT NULL,    -- 完整 AnalysisResult
    title                 TEXT,                     -- 来自音频元数据
    artist                TEXT,
    analyzed_at           TIMESTAMPTZ  NOT NULL     -- 首次完成分析的时间
);

-- 每次上传请求，一个 job_id 一行
CREATE TABLE jobs (
    id                    UUID         PRIMARY KEY,
    audio_id              CHAR(64)     NOT NULL,    -- 关联 analyses，不加 FK（failed job 无对应 analyses 行）
    status                TEXT         NOT NULL,    -- pending | processing | done | failed
    error                 TEXT,                     -- 错误信息，status=failed 时写入
    created_at            TIMESTAMPTZ  NOT NULL,
    analysis_duration_sec FLOAT                     -- 本次 pipeline 耗时（秒）
);

CREATE INDEX ON jobs (audio_id);
CREATE INDEX ON jobs (created_at DESC);
```

历史记录查询：

```sql
SELECT j.id, j.audio_id, j.status, j.created_at, a.result, a.title, a.artist
FROM jobs j
LEFT JOIN analyses a ON j.audio_id = a.audio_id
ORDER BY j.created_at DESC;
```

### Redis

两类 key：

```
analysis:{audio_id}     → AnalysisResult JSON     TTL 7天
                          上传时先查此 key，命中则跳过整个 pipeline

job:{job_id}:status     → "extracting" | "classifying" |
                          "scoring" | "explaining" | "done" | "failed"
                          TTL 1天
                          SSE handler 读此 key 推送进度事件给浏览器
```

### 写入时序

**核心原则：先写事实来源（PG），再写缓存（Redis）。**

原因是两者的失败代价不对称：

- **先写 PG，再写 Redis**：若 PG 成功而 Redis 失败，下次请求 cache miss，从 PG 读出结果，数据完整，只是略慢。可接受的降级。
- **先写 Redis，再写 PG**（错误顺序）：若 Redis 成功而 PG 失败，缓存里有结果但 PG 没有记录。TTL 到期后数据永久消失，历史记录出现空洞，且无法重算。

`job:{job_id}:status = "done"` 放在最后还有一个额外理由：它是通知浏览器"可以来取结果了"的信号。只有 PG 和缓存都落盘之后才推这个信号，浏览器收到后立刻来拉，数据一定已经就绪，不会出现"收到 done 但查不到数据"的竞态。

```
pipeline 开始          → Redis  job:{id}:status = "extracting"
每步完成               → Redis  job:{id}:status = 下一步名称

pipeline 全部完成（写入顺序严格如下）：
  1. PG     INSERT INTO analyses ... ON CONFLICT DO NOTHING  ← result 去重写入
  2. PG     UPDATE jobs SET status='done', duration=...      ← 更新 job 状态
  3. Redis  analysis:{audio_id} = result（TTL 7天）           ← 再写缓存
  4. Redis  job:{id}:status = "done"                         ← 最后推进度信号

pipeline 任意步失败：
  1. PG     UPDATE jobs SET status='failed', error=...       ← 先写 PG
  2. Redis  job:{id}:status = "failed"
```

`ON CONFLICT DO NOTHING` 处理并发：同一文件两个 job 同时完成时，第二个写 `analyses` 直接跳过，不会报错也不会覆盖。

---

## SKILL 注册表模式

**SKILL 体系只适用于 Claude 可调用的工具**（即进 `registry.py` 的条目）。L1-L3 是普通 Python 模块，接口由 `contracts/types.py` 约束，不需要 SKILL.md。

每个 Claude 工具必须同时存在三部分，缺一不可：

```
skills/{name}/SKILL.md           契约文档（I/O schema、验证、限制）
apps/engine/skills/{name}.py     实现函数
apps/engine/registry.py          注册表条目（含 JSON Schema）
```

注册表结构：

```python
SKILL_REGISTRY = {
    "skill-name": {
        "fn": actual_function,
        "schema": {
            "name": "skill_name",
            "description": "...",
            "input_schema": {
                "type": "object",
                "properties": {...},
                "required": [...]
            }
        }
    }
}
```

Orchestrator 从注册表取 schema 传给 Claude，Claude 按需调用，注册表路由到 `fn`。
**换实现只改注册表条目，Orchestrator 不动。**

开发顺序：先写 SKILL.md → 再写实现函数 → 再挂进注册表。

当前规划的 Skill 列表：

| Skill | 层 | 产品位置 |
|-------|----|----|
| `explain-dimension` | L4 | Tab 5 AI解读 — 四个维度各一段自然语言解释 |
| `compare-segments` | L4 | Tab 5 AI解读 — 段落对比 |

---

## 关键设计规则

1. **骨架优先（Skeleton-first）**：Stage 0 把 L5 跑通，ML 层全部 Mock。后续 Stage 1-5 逐层替换 Mock。禁止等所有层做完才跑前端。

2. **L4 永远调真实 Claude**：即使在 Mock 模式下，HarnessOrchestrator 也调用真实 Claude API。Mock 的是工具返回值，不是 Claude 本身。

3. **结论必须有工具调用支撑**：AI 解读中的每个判断必须引用工具调用的返回值，禁止 Claude 自行推断数据。

4. **编排层与执行层解耦**：Orchestrator 不了解任何实现细节，只通过注册表调用 Skill。

5. **缓存策略**：Redis 缓存 key 为音频文件内容 SHA-256。相同文件不重复计算，直接返回缓存结果。

---

## 环境变量

见 `.env.example`，主要变量：

```
ANTHROPIC_API_KEY=
GATEWAY_URL=http://localhost:8080
ENGINE_URL=http://localhost:8000
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

---

## 命名约定

- JSON 字段：`snake_case`
- Go struct 字段：`PascalCase` + `json:"snake_case"` tag
- TypeScript interface：`PascalCase`
- Python dataclass 字段：`snake_case`
- `audio_id`：音频文件内容的 SHA-256，所有 Bundle 的关联键，同时作为 Redis 缓存 key 的一部分（`"analysis:{audio_id}"`）
- `job_id`：每次请求的 UUID，与 `audio_id` 无关；同一文件重复上传产生不同 `job_id` 但相同 `audio_id`
