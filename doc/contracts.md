# Contracts — Computable Beauty

> 各服务层间 HTTP 接口的完整请求/响应体规格。类型定义见 `contracts/types.go / .ts`；架构综述见 `doc/architecture.md`。

---

## 通信层次

```
Browser
  │ multipart / JSON / SSE
  ▼
Next.js Route Handlers (:3000)   ← BFF，纯透传，不做业务逻辑
  │ JSON（内网）
  ▼
Golang Gateway (:8080)           ← 任务调度、SSE 生成、结果聚合
  │ JSON（内网）
  ▼
FastAPI Engine (:8000)           ← L1-L4 AI 计算
```

Gateway 顺序调用 Engine 四个内部端点，每个端点返回后向浏览器推送一次 SSE 进度。

---

## 一、Browser → Next.js Route Handlers

Next.js Route Handlers 是纯代理，不做业务逻辑。此节只写 request；response schema 统一定义在 Section 二（Gateway），浏览器侧响应与之一致。

### POST /api/analyze

**Request**（multipart/form-data）

| 字段 | 类型 | 说明 |
|------|------|------|
| `audio` | File | 音频文件（mp3 / wav / flac / ogg），最大 50MB |

→ 代理 `POST /api/jobs`，response 见 [POST /api/jobs](#post-apijobs)

---

### GET /api/progress?job_id={id}

→ 代理 `GET /api/jobs/{id}/stream`，response 见 [SSE 事件规格](#sse-事件规格)

---

### GET /api/result/:job_id

→ 代理 `GET /api/jobs/{id}`，response 见 [GET /api/jobs/{id}](#get-apijobsid)

---

### POST /api/chat/:job_id

**Request**

```json
{
  "question": "为什么这首歌的生命张力这么高？",
  "conversation_context_id": "ctx-uuid"
}
```

→ 代理 `POST /api/jobs/{id}/chat`，response 见 [POST /api/jobs/{id}/chat](#post-apijobsidchat)

---

### GET /api/history

→ 代理 `GET /api/history`，response 见 [GET /api/history](#get-apihistory-1)

---

### GET /api/demo-tracks

→ 代理 `GET /api/demo-tracks`，response 见 [GET /api/demo-tracks](#get-apidemo-tracks-1)

---

## 二、Next.js → Golang Gateway

所有接口的完整 request/response schema 定义在此节，浏览器侧响应与此一致。

### POST /api/jobs

接收文件，创建分析任务。

**Request**（multipart/form-data）

| 字段 | 类型 |
|------|------|
| `audio` | File |

**Response** `200`

```json
{ "id": "uuid", "status": "pending" | "done" }
```

`status: "done"` 表示缓存命中，结果已就绪；`status: "pending"` 表示已入队，需等待计算。

---

### GET /api/jobs/{id}

查询任务结果。

**Response** `200` → `Job`

```json
{
  "id": "uuid",
  "status": "done | processing | pending | failed",
  "result": { /* AnalysisResult，status=done 时存在 */ },
  "error": "错误信息，status=failed 时存在",
  "analysis_duration_sec": 1.2,
  "created_at": "2026-07-01T14:23:00Z",
  "title": "Forever Love",
  "artist": "X Japan"
}
```

`AnalysisResult` 结构见 `contracts/types.go`：包含 `feature_summary`、`understanding`、`aesthetic`、`explanation`、`summary`、`tool_call_log`、`verified`、`tool_call_count`。

---

### GET /api/jobs/{id}/stream

SSE 进度流，见下方 [SSE 事件规格](#sse-事件规格)。

---

### POST /api/jobs/{id}/chat

**Request** → `ChatRequest`

```json
{
  "question": "为什么这首歌的生命张力这么高？",
  "conversation_context_id": "ctx-uuid"
}
```

**Response** `200` → `ChatResponse`

```json
{
  "answer": "Claude 生成的回答文本",
  "conversation_context_id": "ctx-uuid"
}
```

---

### GET /api/history

**Response** `200` → `HistoryResponse`

```json
{
  "items": [ /* Job[]，每条为完整 Job 对象，含 result */ ],
  "total": 42
}
```

返回完整 `Job` 对象，前端按需取字段渲染。HistoryItem 渲染实际使用：`title`、`artist`、`created_at`、`result.feature_summary.bpm/key/duration_sec`、`result.understanding.genre/emotion_labels`、`result.aesthetic.aesthetic_index`。

---

### GET /api/demo-tracks

**Response** `200`

```json
{
  "tracks": [
    {
      "id": "yoshiki-forever-love",
      "title": "Forever Love",
      "artist": "X Japan",
      "duration_sec": 332,
      "audio_url": "/demo/yoshiki-forever-love.mp3"
    }
  ]
}
```

---

## 三、Golang Gateway → FastAPI Engine（内网）

Gateway 按以下顺序依次调用，每次调用返回后发送一次 SSE 进度事件。

```
extract-features → 20%，classify → 55%，score-aesthetics → 85%，explain 开始 → 95%，explain 完成 → event:done
```

所有内部端点统一规则：
- 仅接受来自 Gateway 的请求（Engine 不对外暴露）
- 请求头携带 `X-Internal-Token` 做服务间鉴权（值来自环境变量 `INTERNAL_TOKEN`）
- 错误统一返回 `{"error": "error_code", "message": "..."}`

---

### POST /internal/extract-features

运行 L1 特征提取。

**Request**

```json
{ "audio_id": "sha256hex", "audio_path": "/data/uploads/sha256hex.mp3" }
```

**Response** `200` → `FeatureSummary`

```json
{
  "bpm": 142.0,
  "tempo_stability": 0.03,
  "key": "D minor",
  "dynamic_range_db": 28.5,
  "spectral_entropy": 4.2,
  "silence_ratio": 0.06,
  "duration_sec": 332.0
}
```

---

### POST /internal/classify

运行 L2 分类（流派、情感、乐器、结构、和弦）。接收 L1 结果作为输入，避免重复计算。

**Request**

```json
{
  "audio_id": "sha256hex",
  "audio_path": "/data/uploads/sha256hex.mp3",
  "feature_summary": { /* FeatureSummary */ }
}
```

**Response** `200` → `UnderstandingBundle`

```json
{
  "audio_id": "uuid",
  "genre": "Orchestral Rock",
  "genre_confidence": 0.87,
  "genre_top3": [
    {"label": "Orchestral Rock", "confidence": 0.87},
    {"label": "Symphonic Metal", "confidence": 0.09},
    {"label": "Classical",       "confidence": 0.04}
  ],
  "emotion_labels": ["dramatic", "intense"],
  "valence": -0.3,
  "arousal": 0.82,
  "tension": 0.71,
  "release": 0.44,
  "energy": 0.58,
  "emotion_arc": [
    {"timestamp_sec": 0,  "valence": -0.1, "arousal": 0.4},
    {"timestamp_sec": 30, "valence": -0.5, "arousal": 0.9}
  ],
  "time_signature": "4/4",
  "instruments": [
    {"name": "piano",   "confidence": 0.94},
    {"name": "strings", "confidence": 0.88},
    {"name": "drums",   "confidence": 0.76}
  ],
  "structure": [
    {"start_sec": 0,  "end_sec": 28,  "label": "intro"},
    {"start_sec": 28, "end_sec": 88,  "label": "verse"},
    {"start_sec": 88, "end_sec": 148, "label": "chorus"}
  ],
  "chords": [
    {"start_sec": 0, "end_sec": 4, "chord": "Dm"}
  ]
}
```

---

### POST /internal/score-aesthetics

运行 L3 美学评分（确定性计算）。接收 L1 + L2 结果。

**Request**

```json
{
  "audio_id": "sha256hex",
  "audio_path": "/data/uploads/sha256hex.mp3",
  "feature_summary": { /* FeatureSummary */ },
  "understanding":   { /* UnderstandingBundle */ }
}
```

**Response** `200` → `AestheticBundle`

```json
{
  "audio_id": "uuid",
  "aesthetic_index": 86.1,
  "physical_precision": {
    "score": 84.0,
    "evidence": {"tempo_stability": 0.03, "dynamic_range_db": 28.5}
  },
  "structural_logic": {
    "score": 78.0,
    "evidence": {"tsd_coverage": 0.68, "segment_balance": 0.81}
  },
  "emotional_depth": {
    "score": 88.0,
    "evidence": {"valence_delta": 1.12, "polarity_switches": 6, "arousal_std": 0.22}
  },
  "vital_tension": {
    "score": 91.0,
    "evidence": {"dynamic_contrast": 0.74, "burst_density": 12.3}
  },
  "weights": {"physical_precision": 0.20, "structural_logic": 0.20, "emotional_depth": 0.30, "vital_tension": 0.30}
}
```

---

### POST /internal/explain

运行 L4 Harness Orchestrator：把 L1-L3 结果传入 Claude tool use 循环，生成自然语言解释，返回最终 `AnalysisResult`。仅在初次分析时调用，追问走 `/internal/chat`。

**Request**

```json
{
  "audio_id": "sha256hex",
  "audio_path": "/data/uploads/sha256hex.mp3",
  "job_id": "uuid",
  "feature_summary": { /* FeatureSummary */ },
  "understanding":   { /* UnderstandingBundle */ },
  "aesthetic":       { /* AestheticBundle */ }
}
```

**Response** `200` → `AnalysisResult`

```json
{
  "audio_id": "uuid",
  "verified": true,
  "tool_call_count": 4,
  "tool_call_log": [
    {
      "tool_name": "explain_dimension",
      "input":  {"dimension": "physical_precision", "score": 84, "evidence": {"tempo_stability": 0.03, "dynamic_range_db": 28.5}},
      "output": {"explanation": "物理精确性得分 84：节拍稳定性 0.03，动态范围 28.5 dB..."},
      "duration_ms": 1430
    }
  ],
  "feature_summary": { /* FeatureSummary */ },
  "understanding":   { /* UnderstandingBundle */ },
  "aesthetic":       { /* AestheticBundle */ },
  "summary":     "这首曲子在物理精确性与生命张力两个维度上表现出色……",
  "explanation": "四维详细解释，Markdown 格式",
  "conversation_context_id": "ctx-uuid"
}
```

---

### POST /internal/chat

用户追问，基于已有 `conversation_context_id` 续接对话，不重新运行 pipeline。

**Request**

```json
{
  "question": "为什么生命张力这么高？",
  "conversation_context_id": "ctx-uuid"
}
```

**Response** `200`

```json
{
  "answer": "Claude 生成的回答，引用工具调用记录中的 evidence 数值",
  "conversation_context_id": "ctx-uuid"
}
```

---

## SSE 事件规格

`text/event-stream` 格式，每个事件一行 `data: {json}\n\n`。

数据结构对应 `SSEEvent`（见 `contracts/types.go`）：

```
data: {"step":"extracting_features","message":"正在提取音频特征...","progress":0.20}

data: {"step":"classifying","message":"正在分类流派与情感...","progress":0.55}

data: {"step":"scoring","message":"正在计算美学评分...","progress":0.85}

data: {"step":"explaining","message":"Claude 正在生成分析...","progress":0.95}

event: done
data: {"step":"done","progress":1.0}
```

`event: done` 是终止信号，客户端收到后关闭连接，转而请求 `/api/result/:job_id`。

失败时：

```
event: error
data: {"step":"failed","message":"特征提取失败：音频格式不支持"}
```

---

## 统一错误响应

所有服务统一使用以下格式，HTTP 状态码对应标准语义：

```json
{
  "error": "snake_case_error_code",
  "message": "人类可读描述"
}
```

| 状态码 | 含义 |
|--------|------|
| `400` | 请求格式错误、文件不合法 |
| `404` | job_id 不存在 |
| `422` | 参数校验失败（FastAPI 默认格式） |
| `500` | 服务内部错误 |
| `503` | 下游服务不可达（Engine 超时等） |

---

## 跨服务类型说明

| 类型 | 所在文件 | 说明 |
|------|----------|------|
| `FeatureBundle` | `contracts/types.py` | 含 numpy array，**只在 Engine 内部流转** |
| `FeatureSummary` | `contracts/types.go / .ts` | Wire-safe 标量子集，跨服务传输用此类型 |
| `UnderstandingBundle` | 三文件均有 | 跨服务传输 |
| `AestheticBundle` | 三文件均有 | 跨服务传输 |
| `AnalysisResult` | 三文件均有 | 最终结果，Gateway 存入 PostgreSQL |
| `Job` | `contracts/types.go / .ts` | Gateway 任务封装，包含 AnalysisResult |
| `SSEEvent` | `contracts/types.go / .ts` | 进度推送事件 |
