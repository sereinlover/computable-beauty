# Roadmap — Computable Beauty

> 各阶段开发目标、关键实现要点、验收标准。系统设计见 `doc/architecture.md`，产品规格见 `doc/product.md`。

---

## 骨架优先原则

原始顺序 L1 → L2 → L3 → L4 → L5 的问题：做完 5 个 Stage 的 ML 工作才能第一次看到产品跑起来，工程动力差，也无法早期发现层间集成问题。

**调整策略：Skeleton-first。**

Stage 0 先做合约定义 + L5 完整骨架 + 所有 ML 层用 Mock 数据。Stage 0 结束时产品就能展示——数据是假的，但 UI、交互、SSE 进度推送、Claude AI 解读全部真实运行。Stage 1-5 是逐层把 Mock 替换成真实实现。

---

## Stage 0 — 合约定义与框架搭建

**目标**：三服务跑通，Mock 数据，真实 Claude 解读。

### Part 1：合约定义（`contracts/`）

三语言类型文件先写好，后续所有层共享，字段名和 JSON 键名全部对齐。见 `contracts/types.py / .go / .ts`。

### Part 2：Mock Engine

三个内部接口返回硬编码 JSON，音频文件接收但忽略。Mock 数据必须像真实数据（不能全零或随机数），Claude 基于这些数值生成 AI 解读，Mock 数据质量决定解读是否合理。

见 `apps/engine/mock/fixtures.py`。

### Part 3：Gateway 骨架

接收上传、分发任务、SSE 推送进度：

```go
func StreamHandler(w http.ResponseWriter, r *http.Request) {
    flusher := w.(http.Flusher)
    steps := []string{"extracting_features", "classifying", "scoring", "explaining", "done"}
    for _, step := range steps {
        fmt.Fprintf(w, "data: {\"step\": \"%s\"}\n\n", step)
        flusher.Flush()
        time.Sleep(500 * time.Millisecond)
    }
}
```

### Part 4：L4 Harness 骨架（Stage 0 就接真实 Claude）

L1-L3 内部端点各自返回 Mock 数据（无 Claude 参与）。Gateway 顺序调用后，将结果传入 `/internal/explain`，此时才启动 Claude Harness。Claude 接收 L1-L3 结果作为上下文，调用 `explain_dimension` 工具对四个维度生成真实解读：

```python
SKILL_REGISTRY = {
    "explain_dimension": {
        "fn": lambda args: {"explanation": f"[Mock] {args['dimension']} score {args['score']}"},
        "schema": {
            "name": "explain_dimension",
            "description": "针对某个美学维度，基于已有 evidence 生成自然语言解释",
            "input_schema": {
                "type": "object",
                "properties": {
                    "dimension": {"type": "string"},
                    "score":     {"type": "number"},
                    "evidence":  {"type": "object"},
                },
                "required": ["dimension", "score", "evidence"],
            },
        },
    },
}
```

### Part 5：Web 骨架

Route Handlers 代理到 Gateway，不做业务逻辑。前端组件先用静态 Props 开发：

```tsx
<EmotionArcChart data={MOCK_ARC_DATA} />
<StructureBar segments={MOCK_SEGMENTS} />
<AestheticDimensions scores={MOCK_SCORES} />
```

### 验收标准

- [ ] `docker-compose up` 把三个服务全部拉起
- [ ] 上传任意音频 → SSE 进度推送正常（extracting_features → classifying → scoring → explaining → done）
- [ ] 结果页 5 个 Tab 全部可点击，各 Tab 渲染对应 Mock 数据：
  - 概览：MetricCards（BPM/AROUSAL/VALENCE/TENSION）+ EmotionArcChart + StructureSection + EmotionDimensions + AestheticDimensions
  - 情感弧线：完整折线图
  - 结构 & 和弦：StructureBar + ChordList
  - 美学评分：AestheticDetail + evidence 数值
  - AI 解读：AIHeader + AIBody + ChatPanel
- [ ] AI 解读是 Claude 真实生成的，逻辑合理（Claude 基于 Mock 数值）
- [ ] HistoryItem 正确展示：曲名 — 艺术家 · 时长 · 调性 · BPM · N分钟前 + 标签 + 美学指数
- [ ] 所有 UI 组件正确渲染，无空白页

---

## Stage 1 — L1 特征层 + dataset-curation

**目标**：UI 展示的 BPM、MFCC、调性是真实计算值；同时备好 Stage 2 训练数据。

两条并行 Track，不要串行。

### Track A：L1 真实特征提取

```python
# AudioLoader
def load_audio(path: str) -> tuple[np.ndarray, int]:
    y, sr = librosa.load(path, sr=22050, mono=True)
    if len(y) / sr > 600:
        raise ValueError("音频超过 10 分钟，不支持")
    return y, sr

# SpectralExtractor — 统一 hop_length=512, n_fft=2048
mfcc     = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)            # (40, T)
mel      = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)  # (128, T)
chroma   = librosa.feature.chroma_stft(y=y, sr=sr)                 # (12, T)
centroid = librosa.feature.spectral_centroid(y=y, sr=sr)           # (1, T)

# TemporalExtractor
tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
beat_times = librosa.frames_to_time(beat_frames, sr=sr)
tempo_stability = float(np.std(np.diff(beat_times)))

# HarmonicExtractor — key detection via chroma template matching
chroma_avg = chroma.mean(axis=1)  # (12,)
key = match_key_template(chroma_avg)  # → "D minor"
# 也可用 Essentia KeyExtractor，免写模板

# DynamicExtractor
rms = librosa.feature.rms(y=y)
dynamic_range_db = float(20 * np.log10(rms.max() / (rms.min() + 1e-9)))
silence_ratio = float((rms < 0.01).mean())
onset_strength = librosa.onset.onset_strength(y=y, sr=sr)

# FeatureAggregator — 同时保留时序版本（供 L2 情感弧线）和统计量版本（供 L3）
# 统计量 = 均值、标准差、第 10/50/90 百分位
```

### Track B：dataset-curation Skill

数据集优先级：

| 任务 | 数据集 | 说明 |
|------|--------|------|
| 流派分类 | GTZAN | 1000 首 30s，10 类，免费 |
| 情感分类 | PMEMO 或 MER-Benchmark | 带 valence/arousal 连续标注 |
| 乐器识别 | OpenMIC-2018 | 2 万条，20 类，Freesound 授权 |

Skill 实现：扫描目录 → 过滤（时长 < 5s 或 > 600s 剔除）→ 标注列名统一化 → 输出 `dataset.csv`（路径 + 标注 + 80/10/10 分割）。

### 验收标准

- [ ] 上传流行歌曲 → BPM 在 60~200，调性字符串格式正确
- [ ] `tempo_stability`：鼓机 EDM < 0.02，人声即兴 > 0.1
- [ ] GTZAN 数据集运行 dataset-curation → 输出合法 `dataset.csv`，无路径缺失和标注空值
- [ ] `apps/engine/tests/test_feature.py` 全部通过

---

## Stage 2 — L2 理解层（基础分类）

**目标**：流派、情感（clip 级）、乐器标签是真实模型预测。`emotion_arc`、`structure`、`chords` 仍 Mock，留 Stage 3。

**策略：先快后好。** 每个分类器顺序：开源预训练/零样本 → 微调 → 从头训练（最后手段）。

### 流派分类（GenreClassifier）

优先 CLAP 零样本，当天可上线：

```python
from transformers import ClapModel, ClapProcessor
model = ClapModel.from_pretrained("laion/clap-htsat-unfused")
genres = ["classical music", "rock music", "jazz", "pop music", "electronic music", ...]
audio_emb = model.get_audio_features(**audio_inputs)
text_emb  = model.get_text_features(**text_inputs)
genre = genres[(audio_emb @ text_emb.T).argmax()]
```

备选（零样本 F1 < 0.60）：用 GTZAN fine-tune 小 CNN，输入 mel 频谱（128×T），输出 10 类 softmax。

### 情感分类（EmotionClassifier）

**项目中唯一需要从头训练的核心模型。** 输入：clip 级 MFCC 统计量 + chroma 均值 + RMS 统计量 + BPM（约 100 维）。

```python
class EmotionMLP(nn.Module):
    def __init__(self, input_dim, num_labels):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, 128),       nn.ReLU(),
            nn.Linear(128, num_labels)
        )
    def forward(self, x):
        return torch.sigmoid(self.net(x))  # 多标签，BCELoss
```

### 乐器识别（InstrumentClassifier）

直接用 Essentia 预训练模型，开箱即用：

```python
import essentia.standard as es
embeddings = es.TensorflowPredictMusiCNN(graphFilename="msd-musicnn-1.pb")(audio)
```

### 验收标准

- [ ] Genre val F1 > 0.60
- [ ] Emotion val F1 > 0.50，快歌 arousal 明显高于慢歌
- [ ] 上传两首不同风格歌曲 → 流派标签有差异
- [ ] `apps/engine/tests/test_classifiers.py` 全部通过

---

## Stage 3 — L2 理解层（进阶 MIR）

**目标**：结构色条、和弦进行列表、情感弧线图全部是真实计算值，L2 Mock 完全替换。

### 结构分析（StructureSegmenter）

优先 MSAF 库：

```python
import msaf
boundaries, labels = msaf.process("audio.mp3", boundaries_id="scluster")
# 段落类型映射（启发式）：第一段→intro，只出现一次→outro，出现最多→chorus
```

备选（MSAF 安装困难）：手写 SSM + novelty curve：

```python
S = librosa.segment.recurrence_matrix(mfcc, mode='affinity', sym=True)
novelty = np.diff(S.diagonal(offset=1))
# 在局部极大值处切割段落
```

### 和弦识别（ChordRecognizer）

chroma 模板匹配，对 demo 够用：

```python
CHORD_TEMPLATES = {
    "C":  [1,0,0,0,1,0,0,1,0,0,0,0],
    "Cm": [1,0,0,1,0,0,0,1,0,0,0,0],
    "Dm": [0,0,1,0,0,1,0,0,0,1,0,0],
    # 覆盖 12 个音的大三、小三、属七
}
def recognize_chord(chroma_frame: np.ndarray) -> str:
    sims = {name: np.dot(chroma_frame, tmpl) / (np.linalg.norm(chroma_frame) + 1e-9)
            for name, tmpl in CHORD_TEMPLATES.items()}
    return max(sims, key=sims.get)
# 逐帧识别后，相邻相同和弦合并，持续 < 1s 的忽略
```

### 情感弧线（EmotionArcModeler）

不是新模型，是对 EmotionClassifier 的滑窗调用：

```python
def model_emotion_arc(y, sr, window_sec=5, hop_sec=1) -> list[EmotionPoint]:
    arc = []
    for start in range(0, int(len(y)/sr) - window_sec, hop_sec):
        segment = y[start*sr : (start+window_sec)*sr]
        feats = extract_clip_features(segment, sr)
        valence, arousal = emotion_model.predict(feats)
        arc.append(EmotionPoint(timestamp_sec=start, valence=valence, arousal=arousal))
    return arc
```

### 验收标准

- [ ] 上传有明显结构的歌 → StructureBar 识别出 ≥ 3 个不同段落
- [ ] 和弦进行列表里的和弦音乐上合理，不全是同一个和弦
- [ ] 情感弧线有起伏，高潮段 arousal 明显高于平静段
- [ ] `emotion_arc` 数据点 ≥ 30（1 分钟以上的歌）

---

## Stage 4 — L3 评估层（美学评分）

**目标**：四维进度条和综合指数是真实计算值。L3 是纯确定性计算，没有模型训练。

每个 Scorer 是独立函数，接受 `FeatureBundle + UnderstandingBundle`，返回 `DimensionScore`（score + evidence dict）。

```python
def score_physical_precision(fb: FeatureBundle) -> DimensionScore:
    beat_score    = 1.0 - min(fb.tempo_stability / 0.1, 1.0)
    dynamic_score = np.clip((fb.dynamic_range_db - 5) / 30, 0, 1)
    mel_thirds    = np.split(fb.mel_spectrogram.mean(axis=1), 3)
    balance_score = 1.0 - np.std([s.mean() for s in mel_thirds])
    score = (beat_score * 0.4 + dynamic_score * 0.3 + balance_score * 0.3) * 100
    return DimensionScore(score=score, evidence={
        "tempo_stability": fb.tempo_stability,
        "dynamic_range_db": fb.dynamic_range_db,
    })

def score_emotional_depth(ub: UnderstandingBundle) -> DimensionScore:
    v = [p.valence for p in ub.emotion_arc]
    a = [p.arousal for p in ub.emotion_arc]
    valence_delta     = float(max(v) - min(v))
    arousal_std       = float(np.std(a))
    polarity_switches = sum(1 for i in range(1, len(v)) if v[i] * v[i-1] < 0)
    score = min((valence_delta * 35 + arousal_std * 35 + polarity_switches * 3), 100)
    return DimensionScore(score=score, evidence={
        "valence_delta": valence_delta,
        "arousal_std": arousal_std,
        "polarity_switches": polarity_switches,
    })

def score_vital_tension(fb: FeatureBundle, ub: UnderstandingBundle) -> DimensionScore:
    dynamic_contrast = float(fb.rms.max() - fb.rms.min())
    peaks, _ = scipy.signal.find_peaks(fb.onset_strength, prominence=0.3)
    burst_density = len(peaks) / (fb.duration_sec / 60)
    score = min((dynamic_contrast * 60 + burst_density * 2), 100)
    return DimensionScore(score=score, evidence={
        "dynamic_contrast": dynamic_contrast,
        "burst_density": burst_density,
    })

def score_structural_logic(fb: FeatureBundle, ub: UnderstandingBundle) -> DimensionScore:
    tsd_coverage  = calc_tsd_coverage(ub.chords, fb.key)
    seg_durations = [s.end_sec - s.start_sec for s in ub.structure]
    balance_score = 1.0 - np.std(seg_durations) / (np.mean(seg_durations) + 1e-9)
    score = (tsd_coverage * 0.5 + balance_score * 0.5) * 100
    return DimensionScore(score=score, evidence={
        "tsd_coverage": tsd_coverage,
        "segment_balance": float(balance_score),
    })
```

**校准步骤**：选 5~8 首已知评价的歌，跑四维评分，判断是否符合直觉，调整权重系数，记录校准过程（面试好素材）。

### 验收标准

- [ ] Yoshiki 代表曲 → 生命张力 + 情感深度明显高于普通流行歌
- [ ] 机械感强的 EDM → 物理精确性高，情感深度低
- [ ] 四维综合指数在 [20, 95] 范围内，不出现极端值
- [ ] 每个 `DimensionScore.evidence` 有具体数值，AI 解读可引用

---

## Stage 5 — L4 智能体层（Harness 全集成）

**目标**：工具调用是真实计算，证据链可审计，追问有上下文支撑。

### 关键变化：只改注册表，不动 Orchestrator

L1-L3 各自的内部端点在 Stage 1-4 逐层替换为真实实现。Stage 5 只需把 `explain_dimension` 从 Mock 换成真实函数：

```python
# Stage 0（Mock）
SKILL_REGISTRY = {
    "explain_dimension": {"fn": lambda args: {"explanation": f"[Mock] {args['dimension']}"}, ...},
}

# Stage 5（真实）— Orchestrator 代码完全不动
from apps.engine.skills.explain_dimension import explain_dimension

SKILL_REGISTRY = {
    "explain_dimension": {"fn": explain_dimension, "schema": {...}},
}
```

### EvidenceTracker

```python
class EvidenceTracker:
    def __init__(self):
        self.calls: list[ToolCallRecord] = []

    def record(self, tool_name, input_data, output_data, duration_ms):
        self.calls.append(ToolCallRecord(
            tool_name=tool_name, input=input_data,
            output=output_data, duration_ms=duration_ms
        ))

    def to_chain(self) -> list[dict]:
        return [asdict(c) for c in self.calls]
```

### ConversationHandler（追问）

```python
def handle_followup(question: str, history: list[dict]) -> str:
    history.append({"role": "user", "content": question})
    response = client.messages.create(
        model="claude-sonnet-4-6",
        messages=history,   # 包含完整工具调用记录
        tools=TOOL_SCHEMAS,
        # Claude 基于已有 tool_result 回答，不需要重新调用工具
    )
    return response.content[0].text
```

### System Prompt（真实数据版）

见 `apps/engine/harness/system_prompt.py`。Claude 接收 L1-L3 结果作为上下文，只调用 `explain_dimension` 工具，所有数值必须来自已提供的 feature_summary / understanding / aesthetic 字段。

### 验收标准

- [ ] `verified: true` 是真实经过工具链的
- [ ] `tool_call_count` 准确（默认 4：explain_dimension × 4）
- [ ] 用户追问"为什么张力这么高" → Claude 引用具体 evidence 数值回答
- [ ] UI 展开工具调用记录，每条有 input/output/耗时

### SKILL 产出

- [ ] `skills/explain-dimension/SKILL.md` + 注册条目

---

## Stage 6 — 优化与部署

**目标**：同一首歌第二次上传秒返回，流派识别延迟 < 200ms，有可访问 demo URL。

### ONNX 加速（GenreClassifier → Golang）

```python
# apps/engine/export_onnx.py
torch.onnx.export(
    genre_model, dummy_mel,
    "models/genre_classifier.onnx",
    input_names=["mel_spectrogram"],
    output_names=["genre_logits"],
    dynamic_axes={"mel_spectrogram": {2: "time"}},
)
```

```go
// apps/gateway/onnx/genre.go
session, _ := ort.NewAdvancedSession(
    "models/genre_classifier.onnx",
    []string{"mel_spectrogram"}, []string{"genre_logits"}, nil,
)
output, _ := session.Run(melTensor)
```

只对 GenreClassifier 做 ONNX（延迟最敏感），其余仍走 FastAPI。

### Redis 缓存（`apps/gateway/`）

key = `"analysis:" + audio_id`（audio_id = 文件内容 SHA-256），TTL 7 天。

```go
func (s *Service) Analyze(ctx context.Context, audioID, audioPath string) (*AnalysisResult, error) {
    if cached, err := s.redis.Get(ctx, "analysis:"+audioID).Bytes(); err == nil {
        var result AnalysisResult
        json.Unmarshal(cached, &result)
        return &result, nil
    }
    result, err := s.runFullPipeline(ctx, audioID, audioPath)
    if err != nil { return nil, err }
    s.redis.Set(ctx, "analysis:"+audioID, result, 7*24*time.Hour)
    return result, nil
}
```

### 部署

目标平台：**Fly.io**（Docker 支持好，免费额度够用）。

```bash
fly launch --name computable-beauty-engine   # FastAPI
fly launch --name computable-beauty-gateway  # Golang
fly launch --name computable-beauty-web      # Next.js
```

注意：engine 需要较大内存（PyTorch CPU 推理约 1~2GB）。如果免费额度不够，可以把 engine 跑本地，只部署 gateway 和 web，用录制视频演示。

### 验收标准

- [ ] 同一首歌第二次上传 → 立即返回（< 100ms），确认命中 Redis
- [ ] Golang ONNX 流派识别延迟 < 200ms
- [ ] 有可访问的 demo URL 或录制好的 demo 视频

---

## Stage 7 — 写文章

**目标**：面试前发布完整技术文章，让面试官在约面试前看到思路深度。

### 文章结构

1. **为什么做这个项目** — Yoshiki 触发的问题，职业转型背景，为什么选"可计算的美"
2. **产品是什么** — 截图 + 美学四维设计理念 + "已校验"标记的工程价值
3. **系统架构** — L1-L5 分层，三服务职责，SKILL 注册表：编排层与执行层解耦
4. **像搭积木一样建设系统**（核心）— 按 Stage 0-6 展开，每个技术点配最小可运行代码，重点讲 Stage 0（骨架）和 Stage 5（Harness 集成）
5. **知识全景** — 傅里叶变换到 MFCC，MIR 分类任务，Agent 工程与 Harness，三服务职责划分

### 写作原则

- 不要写成教程——讲你怎么做的，以及为什么
- 保留决策痕迹：哪些方案考虑过、最终选了什么、为什么
- 用具体数字：F1 分数、延迟数值，不写"性能不错"
- Yoshiki 是好的开头和结尾

### 验收标准

- [ ] 文章发布（Medium 或个人博客）
- [ ] 面试时能用 5 分钟口头把核心论点讲清楚
- [ ] 每一个技术选择都能说出"为什么这样而不是另一种做法"
