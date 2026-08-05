# Product Spec — Computable Beauty

> **事实来源**：UI 结构、L3 评分逻辑、L4 Harness 设计均以此文件为准。其他文件和代码以此对齐，不得反向修改此文件来迁就实现。

---

## 页面结构

### 全局导航

```
Navbar
├── Logo          "ComputableBeauty"（Computable 黑色，Beauty 蓝紫色）
└── NavLinks      分析 | 历史 | API 文档
```

---

### 首页（`/`）

```
HomePage
├── UploadZone
│   ├── 虚线边框容器
│   ├── 音符图标
│   ├── 主文案     "上传一段音乐，看见它的内在结构"
│   ├── 副文案     "支持 MP3 · WAV · FLAC，最大 50MB"
│   └── ButtonRow  [选择文件]  [使用 Demo 曲目]
│
├── ProgressPanel  （上传后替换 UploadZone 显示，SSE 实时进度，分析完跳转结果页）
│
└── RecentAnalysisList  （标题："最近分析"）
    └── HistoryItem × N
        ├── 左：音符图标 + 曲名 — 艺术家（主行）
        │          时长 · 调性 · BPM · N分钟前（副行）
        ├── 中：流派标签 + 情感标签（pill 样式，颜色区分类别）
        └── 右：美学 0.xx（综合指数，0~1 浮点显示）
```

---

### 结果页（`/result/:job_id`）

```
ResultPage
├── ResultNavbar
│   ├── Logo
│   └── ActionButtons   [JSON 导出]  [分享链接]
│
├── TitleRow
│   ├── 左：曲名（大）+ 艺术家 · 时长 · 分析耗时 Xs + ✓ 已校验
│   └── 右：美学综合指数（大字，0~1 浮点，如 0.84）
│
├── TagRow
│   └── 流派标签 × N + 情感标签 × N + 乐器标签 × N + BPM pill + 调性 pill + 拍号 pill（如 4/4）
│
└── TabPanel  （5 个 Tab）
    ├── Tab 1：概览（默认选中）
    │   ├── MetricCards（4 个）
    │   │   ├── BPM（数值 bpm）
    │   │   ├── AROUSAL（数值 arousal）
    │   │   ├── VALENCE（数值 valence）
    │   │   └── TENSION（数值 tension）
    │   │
    │   ├── EmotionArcChart（迷你版，Recharts 双折线：arousal + valence）
    │   │
    │   └── OverviewBottom（三列布局）
    │       ├── StructureSection
    │       │   ├── 标题：结构分段 N 段
    │       │   ├── SegmentBar（色条，颜色编码：intro/verse/chorus/bridge/outro/...）
    │       │   ├── 时间轴（起止时间）
    │       │   └── ChordInline（和弦进行，pill 样式）
    │       │
    │       ├── EmotionDimensions（5 项带数值）
    │       │   ├── arousal   0.xx
    │       │   ├── valence   0.xx
    │       │   ├── tension   0.xx
    │       │   ├── release   0.xx
    │       │   └── energy    0.xx
    │       │
    │       └── AestheticDimensions（标题："美学四维 YOSHIKI框架"）
    │           ├── 物理（physical_precision）进度条 + 0.xx
    │           ├── 生命（vital_tension）    进度条 + 0.xx
    │           ├── 逻辑（structural_logic） 进度条 + 0.xx
    │           ├── 情感（emotional_depth）  进度条 + 0.xx
    │           └── 综合                     数值 0.xx（加粗）
    │
    ├── Tab 2：情感弧线
    │   └── EmotionArcChart（完整大图，arousal + valence 双折线，可悬停查看时间点数值）
    │
    ├── Tab 3：结构 & 和弦
    │   ├── StructureBar（完整色条，含段落标签和时间范围）
    │   └── ChordList（完整和弦进行时间轴列表）
    │
    ├── Tab 4：美学评分
    │   └── AestheticDetail（四维详细拆解，含 evidence 数值表格，供深度阅读）
    │
    └── Tab 5：AI 解读
        ├── AIHeader    "✦ AI 解读 · HARNESS 校验完成 · N 项工具调用"
        ├── AIBody
        │   ├── AISummary     summary 字段（2-3 句总体结论，加粗段落）
        │   └── AIExplanation explanation 字段（四维各一段详细解释，Markdown 格式）
        └── ChatPanel
            ├── 标题："继续追问（基于本次分析结果）"
            └── 输入框 + 发送按钮
```

**Tab 设计原因**：不同用户关注不同粒度——面试官看综合指数，音乐人看和弦进行，工程师看 AI 推理过程。Tab 让每一层完整且互不干扰。

---

### 数值显示规则

| 字段 | 存储格式 | 显示格式 | 示例 |
|------|----------|----------|------|
| `aesthetic_index` | 0~100 float | ÷100 → 0.xx | 86.1 → 0.86 |
| `physical_precision.score` 等四维分数 | 0~100 float | ÷100 → 0.xx | 84 → 0.84 |
| `valence` / `arousal` | -1~1 / 0~1 float | 原值显示 | 0.38 |
| `bpm` | float | 取整显示 | 72 bpm |

---

## 美学四维定义

> L3 评分层的实现依据。每个维度的 `evidence` 字段必须包含下列关键数值，供 L4 Agent 引用。

### 物理精确性（Physical Precision）

测量音乐在物理信号层面的精确程度与控制力。

| 特征 | 来源 | 说明 |
|------|------|------|
| `tempo_stability` | `librosa.beat.beat_track` | BPM 方差，越低越稳 |
| `frequency_balance` | mel 频谱低/中/高频能量比 | 频谱分布均匀度 |
| `dynamic_range_db` | RMS 最大值 - 最小值 | 响度包络变化幅度 |
| `spectral_entropy` | mel 频谱平均信息熵 | 音色复杂度代理 |

> 高精确性 ≠ 高分。它是美的载体，不是核心。意义在于与情感张力形成对比。

### 结构逻辑（Structural Logic）

测量音乐内部的逻辑自洽性——和声功能、段落比例是否构成有内在理由的整体。

| 特征 | 来源 | 说明 |
|------|------|------|
| `tsd_coverage` | 和弦序列分析 | T-S-D 功能进行覆盖比例 |
| `segment_balance` | 结构分段时长 | 各段时长分布均衡度 |
| `key_stability` | 调性分析 | 转调频率与解决情况 |

> "这首歌说得通"的来源。结构逻辑极高但情感张力低 → 可预期，不是美。

### 情感深度（Emotional Depth）

测量情感弧线的变化幅度与完整程度——不是"有多悲"，而是"情感的旅程有多完整"。

| 特征 | 来源 | 说明 |
|------|------|------|
| `valence_delta` | emotion_arc max - min | 弧线峰谷落差 |
| `polarity_switches` | 相邻帧正负翻转次数 | 情绪极性转折密度 |
| `arousal_std` | emotion_arc arousal 标准差 | 唤醒度离散程度 |
| `high_arousal_ratio` | arousal > 0.6 的帧占比 | 高唤醒段落时长比 |

> Yoshiki 音乐"击穿感"最直接的来源。从极静到极烈，从绝望到爆发。

### 生命张力（Vital Tension）

测量对立元素之间的拉力——安静与爆炸、紧张与释放之间的精准处理。

| 特征 | 来源 | 说明 |
|------|------|------|
| `dynamic_contrast` | RMS 最强段 / 最弱段比值 | 响度动态对比 |
| `burst_density` | onset_strength 局部极大值数 / 分钟 | 能量突变频率 |
| `silence_burst_ratio` | 静音帧 / 高能帧时长比 | 沉默与爆发交替比 |
| `dissonance_ratio` | 和弦不协和音程比例 | 谐波张力 |

> 最难量化、最接近"美的直觉"的维度。不是情感深度，是对立制造意义的能力。

### 综合美学指数

```python
aesthetic_index = (
    physical_precision.score * weights["physical_precision"] +
    structural_logic.score   * weights["structural_logic"]   +
    emotional_depth.score    * weights["emotional_depth"]    +
    vital_tension.score      * weights["vital_tension"]
)
# 直觉权重：emotional_depth + vital_tension > physical_precision + structural_logic
# 初始值：{"physical_precision": 0.20, "structural_logic": 0.20,
#          "emotional_depth": 0.30, "vital_tension": 0.30}
```

权重作为可配置参数暴露，后续可替换为学习权重。

---

## Harness 可信验证

"已校验"是工程承诺，不是装饰标签。

### 技术含义

L1-L3 是确定性 Python 模块，由 Gateway 顺序调用，**不经过 Claude**。
Harness 是 L4 的 Claude tool_use 控制循环，接收 L1-L3 的计算结果作为上下文输入。

```
用户上传音频
    ↓
【确定性 pipeline，无 Claude 参与】
    L1 extract-features  →  FeatureSummary（MFCC、chroma、onset、BPM...）
    L2 classify          →  UnderstandingBundle（流派、情感弧线、乐器、结构、和弦）
    L3 score-aesthetics  →  AestheticBundle（四维分数 + evidence 字段）
    ↓
【L4 Harness：Claude tool_use 循环启动】
    system prompt 注入：feature_summary + understanding + aesthetic
    explain_dimension("physical_precision", 84, evidence)  →  自然语言解释
    explain_dimension("structural_logic",   76, evidence)  →  自然语言解释
    explain_dimension("emotional_depth",    91, evidence)  →  自然语言解释
    explain_dimension("vital_tension",      88, evidence)  →  自然语言解释
    ↓
Claude 生成最终结论（只能引用工具返回值，不得自行推断）
    ↓
输出 AnalysisResult（verified=True，tool_call_log 完整，tool_call_count=4）
```

### "已校验"的三个承诺

1. **结论有来源**：每条分析结论对应至少一次工具调用返回值
2. **调用可追踪**：UI 展示的"N 项工具调用"可展开，每条有 input + output
3. **结论可质疑**：追问"为什么情感深度高"时，Agent 基于已有 tool_call_log 回答，不重新计算

### UI 展示要求

- `AestheticIndexCard` 右上角显示"已校验"标记（当 `verified === true`）
- `AIExplanationPanel` 显示工具调用次数（`tool_call_count`），可展开每条记录
- `ChatPanel` 追问时传入 `conversation_context_id`，后端复用已有工具调用上下文

---

## 核心设计约束

**不做流式分析**：分析一次性触发，等全曲处理完才返回。情感弧线、结构比例依赖全局视角，分帧实时分析无法支撑美学评分。

**结果页用 Tab 不用单页**：不同用户关注不同粒度，Tab 让每层完整不互相干扰。

**工具调用次数显式展示**：`tool_call_count` 放在 UI 上，说明结论经过了 N 步推理，是可信度信号，不是炫耀。
