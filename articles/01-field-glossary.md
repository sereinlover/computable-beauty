# 字段全解：Computable Beauty 里每个专业字段是什么意思

> 对照 `contracts/types.py / .go / .ts` 和 `apps/engine/mock/fixtures.py` 一起读。
> 文章顺序 = 数据在 pipeline 里流动的顺序：L1 特征 → L2 理解 → L3 美学 → L4 解读。

---

## 前置：音频信号处理的最小地基

在读每个字段之前，需要先建立四个基本概念。后面每个字段都建在这四个概念之上。

> **注意：`types.py` 里有两种不同的类型，不要混淆：**
>
> | 类型 | 作用 | 能否跨服务 |
> |------|------|-----------|
> | `FeatureBundle` | L1 → L2 内部传递，含 numpy 数组 | ❌ 不能，只在 Engine 内部流转 |
> | `FeatureSummary` | L1 计算结果的标量子集 | ✅ 能，wire-safe JSON |
>
> 文章第一节讲的是 `FeatureSummary`（跨服务字段）。`FeatureBundle` 的数组字段（mfcc、mel_spectrogram 等）单独在下面说明。

### 什么是"帧"（Frame）

librosa 读取音频后得到一个连续的数值数组 `y`，比如采样率 22050Hz 的 5 分钟歌曲就是 `22050 × 300 ≈ 6,615,000` 个数字。

直接对整段音频做分析没有意义——歌曲的频率内容随时间变化，我们需要看"这一小段时间里有哪些频率"。

解法是**分帧**：把音频切成一小段一小段，每段叫一帧。

```
y: [样本0, 样本1, ..., 样本6615000]
         ↓ 分帧 (n_fft=2048, hop_length=512)
帧0: [样本0   ~ 样本2047]
帧1: [样本512 ~ 样本2559]  ← 与帧0 重叠 1536 个样本
帧2: [样本1024~ 样本3071]
...
```

- `n_fft`：每帧包含多少个样本（2048 个样本 / 22050Hz ≈ 93ms）
- `hop_length`：相邻两帧的起点间隔（512 个样本 / 22050Hz ≈ 23ms）
- 帧之间有大量重叠，是为了保证边界不被切断

**一首 5 分钟的歌有多少帧？** 6,615,000 / 512 ≈ **12,920 帧**。

所有频谱特征（MFCC、chroma、mel 频谱图）的形状都是 `(特征维度, 帧数)`。

---

### 什么是 STFT（短时傅里叶变换）

对每一帧做**傅里叶变换**，就知道这一帧里各个频率的能量。

傅里叶变换的本质：**任何信号都能分解成若干正弦波的叠加**。STFT 就是逐帧做这件事。

```
一帧原始波形: [0.1, 0.3, -0.2, 0.5, ...]  ← 时域（时间vs振幅）
      ↓ FFT
频域: [(100Hz, 能量0.8), (200Hz, 能量0.2), (3000Hz, 能量0.05), ...]
```

对整首歌做 STFT 就得到**频谱图**（Spectrogram）：横轴是时间（帧），纵轴是频率，颜色是能量。

所有"频谱特征"——mel 频谱图、chroma、MFCC——都是对 STFT 结果的不同角度的二次加工。

---

### 什么是 RMS（均方根能量）

RMS = Root Mean Square，衡量某一帧的**总体响度**。

```python
# 一帧的 RMS
rms_frame = np.sqrt(np.mean(frame ** 2))
```

对整首歌逐帧算 RMS，就得到一条随时间变化的"响度曲线"。这条曲线用于：
- `dynamic_range_db`：曲线最高点 vs 最低点的差
- `dynamic_contrast`（生命张力 evidence）：同上
- `silence_ratio`：曲线低于阈值的帧占比

---

### 什么是 Mel 频谱图（Mel Spectrogram）

Mel 频谱图是对 STFT 频谱的再次加工，是 MFCC 和 spectral_entropy 共同的输入：

1. STFT 得到线性频率轴（0Hz → 11025Hz，均匀间隔）
2. 人耳对低频更敏感，对高频分辨率下降——Mel 尺度模仿人耳，把频率轴**非线性压缩**（低频密，高频稀）
3. 用 128 个 Mel 滤波器把 STFT 能量聚合成 128 维

```python
mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
# shape: (128, T)   ← 128 个 mel 频带，T 帧
```

Mel 频谱图比原始 STFT 更接近人耳的感知，是大多数音频 ML 特征的基础。后文的 `mfcc` 和 `spectral_entropy` 都建在它之上。

---

## 零、FeatureBundle — L1→L2 引擎内部类型

`FeatureBundle` 只在 FastAPI Engine 内部流转，绝不序列化出去。它包含完整的时序数组，供 L2 分类器使用。

```python
@dataclass
class FeatureBundle:
    audio_id: str
    duration_sec: float
    sample_rate: int        # 固定 22050 Hz

    # 时序数组 — 形状都是 (维度, T帧)
    mfcc: np.ndarray            # (40, T)
    mel_spectrogram: np.ndarray # (128, T)
    chroma: np.ndarray          # (12, T)
    spectral_centroid: np.ndarray  # (T,)
    rms: np.ndarray             # (T,)
    onset_strength: np.ndarray  # (T,)

    # 标量 — 这些会被提取到 FeatureSummary 跨服务传输
    bpm: float
    tempo_stability: float
    key: str
    dynamic_range_db: float
    spectral_entropy: float
    silence_ratio: float
```

### `sample_rate`（采样率，固定 22050 Hz）

音频每秒采样多少个点。22050 Hz 是 librosa 的默认值，覆盖人耳可听范围（20Hz~20kHz）的一半（奈奎斯特定理：采样率至少是最高频率的两倍）。

所有后续计算的时间分辨率都从这里导出：`hop_length=512` 样本 → 每帧约 23ms。

---

### `mfcc`（梅尔频率倒谱系数，(40, T)）

MFCC（Mel-Frequency Cepstral Coefficients）是音频 ML 中最重要的特征，是情感分类模型的主要输入。

#### 为什么 MFCC 重要？

直觉：人说话时，**声道形状**（嘴巴、喉咙）决定了声音的音色，而 MFCC 就是在描述这个"形状"的包络，把与内容无关的频率细节过滤掉。同理，乐器的音色也有类似的包络特征——钢琴和小提琴演奏同一个音，MFCC 会不同，因为音色不同。

#### 怎么算出来的（三步）

**第一步：Mel 频谱图** — 已在前置节"什么是 Mel 频谱图"解释，得到 (128, T) 数组。

**第二步：对数压缩** — 把 Mel 频谱图取 log：

```python
log_mel = np.log(mel_spectrogram + 1e-9)
```

这一步模仿人耳对能量的对数感知（响度感知是对数的，跟 dB 同理）。

**第三步：DCT（离散余弦变换）** — 把 128 维压缩成 40 维：

```python
mfcc = scipy.fftpack.dct(log_mel, axis=0, type=2, norm='ortho')[:40]
# 只保留前 40 个系数
```

DCT 的作用：把频带能量的"全局模式"提取出来，丢掉帧与帧之间的冗余信息。前几个系数捕捉整体音色轮廓，后面的系数捕捉细节。只保留前 40 个，就像 JPEG 压缩只保留低频系数一样。

**结果**：每帧 40 个数，对应这帧音频音色的"指纹"。相似的音色 → 相似的 MFCC 向量。

用途：
- 计算 SSM（段落分析）：两帧 MFCC 相似 → 段落相似
- 情感分类特征：MFCC 统计量（均值 + 标准差）是情感 MLP 的输入之一

---

### `spectral_centroid`（频谱重心，(T,)）

每帧频谱能量的**加权平均频率**——频率越高权重越大，所以重心越高意味着高频能量越多。

```python
spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
# shape: (1, T)  → 每帧一个值，单位 Hz
```

直觉：
- 女高音 / 小提琴高音区：重心高（3000+ Hz）
- 低音提琴 / 男低音：重心低（300–800 Hz）
- 随着高潮段混入铜管和高音区，重心通常上升

`spectral_centroid` 不出现在 FeatureSummary 里（不跨服务传输），但在 L2 的情感/张力计算中会用到。

---

### `onset_strength` / `rms` / `chroma` / `mel_spectrogram`

这四个数组在前置节或后文各字段的"技术细节"里解释，此处只做索引：

| 数组 | 形状 | 解释位置 | 方向 |
|------|------|---------|------|
| `rms` | (T,) | 前置节"什么是 RMS" | ↑ 已在前面 |
| `mel_spectrogram` | (128, T) | 前置节"什么是 Mel 频谱图" | ↑ 已在前面 |
| `chroma` | (12, T) | `key` 技术细节（section 一） | ↓ 见后文 |
| `onset_strength` | (T,) | `burst_density` 技术细节（section 三） | ↓ 见后文 |

---

## 一、FeatureSummary — L1 特征层输出（跨服务 wire 类型）

这是对一首歌的**物理测量结果**，所有值都来自信号本身，不需要任何模型判断。

---

### `bpm`（Beats Per Minute，每分钟拍数）

节拍速度。人耳感受到的"这首歌快还是慢"对应的数字。

- 慢歌：60–80 BPM（抒情 ballad）
- 流行：90–130 BPM
- EDM / 快速摇滚：130–180 BPM
- Forever Love 示例值：**142.0**（偏快，符合摇滚感）

#### 技术细节：为什么用自相关分析来检测 BPM？

**自相关（Autocorrelation）**的本质：把信号和它自身做延迟比较，看"这个信号和它自己错开 τ 秒之后有多像"。

直觉：一首 120 BPM 的歌，每 0.5 秒有一个拍子。如果把这首歌的能量曲线向右平移 0.5 秒，和原来的曲线会非常相似（因为每半秒都有一次能量峰）。平移 1.0 秒也会相似，1.5 秒也是——这个相似性会周期性地出现。

```
原始能量曲线：  __|‾|__|‾|__|‾|__|‾|__
平移 0.5 秒后：         __|‾|__|‾|__|‾|__|‾|__
重叠部分的相关性 → 高（因为拍子对齐了）

平移 0.3 秒后：      __|‾|__|‾|__|‾|__|‾|__
重叠部分的相关性 → 低（拍子错开了）
```

自相关函数在"节拍间隔"处会出现峰值。找到最强的峰值对应的时间延迟 τ，就是拍子间隔，BPM = 60 / τ。

librosa 实际实现：`librosa.beat.beat_track()` 先提取 onset strength（能量突变强度，详见后文 `burst_density` 节），再对这条曲线做自相关，找最强周期性。

---

### `tempo_stability`（节拍稳定性）

相邻拍之间时间间隔的**标准差**（单位：秒）。值越小，节拍越稳；值越大，节拍越"摇摆"。

```python
beat_times = librosa.frames_to_time(beat_frames, sr=sr)
tempo_stability = float(np.std(np.diff(beat_times)))
# np.diff(beat_times) = [t1-t0, t2-t1, t3-t2, ...]  ← 每个拍子间隔
# np.std(...)         = 这些间隔的标准差
```

- 鼓机 EDM：< 0.02（间隔几乎完全相等）
- 人声即兴演奏：> 0.1（演奏者会随感觉加速减速）
- Forever Love 示例值：**0.03**（鼓机编程，极稳定）

---

### `key`（调性）

这首歌建立在哪个音上、是大调（Major）还是小调（Minor）。

常见格式：`"D minor"`、`"C major"`、`"F# minor"`

- 大调：听起来"明亮"、"积极"
- 小调：听起来"忧郁"、"紧张"
- Forever Love 示例值：**"D minor"**（符合 Yoshiki 风格的悲剧性色彩）

#### 技术细节：chroma 特征是什么？怎么用它检测调性？

> **注意**：调性检测（这里）和和弦识别（`chords` 节）都用 chroma，但模板不同。
> 调性模板 = 7个音+权重（整首歌的音程分布），和弦模板 = 3个音0/1（逐帧匹配三和弦）。

**第一步：什么是 chroma 特征（色度图）**

音乐里的音高可以用音名表示：C、C#、D、D#、E、F、F#、G、G#、A、A#、B，共 12 个。不同八度的"C"在音乐上等价（都叫 C），所以可以把所有频率**折叠到 12 个音类**里。

chroma 特征就是：**在每一帧里，12 个音各有多少能量**。

```python
chroma = librosa.feature.chroma_stft(y=y, sr=sr)
# shape: (12, T)  ← 12 个音，T 帧
# chroma[0] = C 的能量曲线
# chroma[2] = D 的能量曲线
# ...
```

对整首歌取均值：
```python
chroma_avg = chroma.mean(axis=1)  # shape: (12,)
# 这首歌里 12 个音的平均能量分布
```

**前置知识：为什么不同调里 12 个音的使用频率不一样？**

先回答一个问题：一首 C 大调的曲子里，12 个音符出现的次数是均等的吗？

**不是。** C 大调的音阶只由 7 个音构成：**C、D、E、F、G、A、B**。

作曲家写 C 大调的曲子时，旋律和和弦几乎只用这 7 个音，另外 5 个音（C#、D#、F#、G#、A#，钢琴上的黑键）偶尔出现，但很少。这是调性音乐几百年来的写作惯例。

所以如果你去统计一首 C 大调曲子里 12 个音出现的次数：
```
C  →  频率很高（主音，旋律倾向于停在这里）
G  →  频率较高（属音，最重要的支撑音）
E  →  频率较高（三音，定义大调音色）
D、F、A、B  →  中等（都在音阶里，会用但不如前三个多）
C#、D#、F#、G#、A#  →  频率很低（不属于这个调）
```

而且即使在 7 个音内部，也有**层级**：
- **主音（Tonic）C**：旋律的"终点"和"家"，出现最频繁
- **属音（Dominant）G**：制造张力、然后回家，出现次之
- **中音（Mediant）E**：定义大调/小调音色，第三重要
- 其余 4 个音：属于"过路音"，重要性递减

这个层级是西方功能和声（functional harmony）几百年演化的结果——巴赫到流行乐都遵循这个规律。

Krumhansl（1990）做了实验：让被试听 C 大调背景音乐，然后听一个音，评分"这个音在刚才那段调里听起来多合适"。结果 12 个音的评分和上面的统计高度吻合，于是这组评分被用作调性模板。

---

**第二步：什么是 24 个调的模板**

**前置：七个自然调式与大小调的关系**

从同一套白键（C 大调的音符集）出发，从不同的音开始，会得到 7 种不同的音程模式，叫做**自然调式**：

```
从 C 开始：C D E F G A B  — Ionian    （自然大调）  W-W-H-W-W-W-H
从 D 开始：D E F G A B C  — Dorian    （多利亚）    W-H-W-W-W-H-W
从 E 开始：E F G A B C D  — Phrygian  （弗里几亚）  H-W-W-W-H-W-W
从 F 开始：F G A B C D E  — Lydian    （利底亚）    W-W-W-H-W-W-H
从 G 开始：G A B C D E F  — Mixolydian（混合利底亚） W-W-H-W-W-H-W
从 A 开始：A B C D E F G  — Aeolian   （自然小调）  W-H-W-W-H-W-W
从 B 开始：B C D E F G A  — Locrian   （洛克利亚）  H-W-W-H-W-W-W
```

七种模式用的是**同一批音**，区别只在起点——起点不同，音程关系和听感就完全不同。

**为什么只有大调（Ionian）和小调（Aeolian）独大？** 巴洛克时期（约1600年）之后，西方作曲家逐渐把这两种模式确立为主流，因为它们和"功能和声"（T-S-D）配合得最好——大调有完整的属七和弦到主和弦的张力解决，小调也有对应的和声体系。其余五种模式被边缘化，主要保留在民乐（Dorian 常见于凯尔特、中国音乐）、爵士、金属等风格。

**大调和小调的本质区别：第三音**

```
C大调（Ionian）：  C  D  E   F  G  A   B
C小调（Aeolian）： C  D  Eb  F  G  Ab  Bb
                        ↑           ↑    ↑
                     降了半音    降了半音  降了半音
                     (b3)        (b6)    (b7)
```

最关键的差异是**第三音**：E（大三度）vs Eb（小三度）。大三度 → 明亮积极，小三度 → 暗色忧郁。这是大小调听感差异的物理来源。

---

西方音乐有 12 个大调 + 12 个小调 = 24 个调。

以 C 大调为例，它的 Krumhansl 轮廓（12 维权重向量）：

```
C大调模板：[6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
            C     C#    D     D#    E     F     F#    G     G#    A     A#    B
```

可以看到：
- C（6.35）、G（5.19）、E（4.38）、F（4.09）—— 高值，C大调核心音
- D（3.48）、A（3.66）、B（2.88）—— 中值，音阶内但次要
- C#（2.23）、D#（2.33）、F#（2.52）、G#（2.39）、A#（2.29）—— 低值，不属于C大调

**大调音阶的音程模式是固定的：全全半全全全半（W-W-H-W-W-W-H）**，从哪个音起步就用哪 7 个音。以 D 大调为例：

```
D  →(全)→  E  →(全)→  F#  →(半)→  G  →(全)→  A  →(全)→  B  →(全)→  C#  →(半)→  D
```

D 大调的 7 个音 = **D、E、F#、G、A、B、C#**，其余 5 个（C、D#、F、G#、A#）是调外音。

D 大调模板就是 C 大调模板**循环右移 2 位**（D 比 C 高 2 个半音）：

```
           C     C#    D     D#    E     F     F#    G     G#    A     A#    B
C大调：  [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
D大调：  [2.29, 2.88, 6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66]
```

D 大调的高值落在 D（6.35）/F#（4.38）/A（5.19）——恰好是 D 大调的主音/中音/属音，C 和 F 这些调外音降到低值。

**全全半全全全半是自然大调（Ionian）专属的音程模式，自然小调（Aeolian）不同：**

```
自然大调 Ionian：   全 全 半 全 全 全 半   W-W-H-W-W-W-H
自然小调 Aeolian：  全 半 全 全 半 全 全   W-H-W-W-H-W-W
```

用 D 小调（Forever Love 的调）验证：

```
D  →(全)→  E  →(半)→  F  →(全)→  G  →(全)→  A  →(半)→  Bb  →(全)→  C  →(全)→  D
```

D 自然小调 7 个音：**D、E、F、G、A、Bb、C**

对比 D 大调，小调有三个音被降了半音：

```
D大调：  D  E  F#  G  A  B   C#
D小调：  D  E  F   G  A  Bb  C
              ↑            ↑   ↑
           降半音(b3)   降半音(b6、b7)
```

第三音（E vs Eb/F）的差异最关键：大三度 → 明亮，小三度 → 暗色。这也是"大调听起来积极、小调听起来忧郁"的物理原因。

因此 **24 个模板只需两条基准**（C大调轮廓 + C小调轮廓），分别循环右移 0–11 位即可生成全部 24 个。大调和小调用各自的基准，因为两套模式的音符集和权重分布不同。

**第三步：相似度匹配**

把歌曲的 `chroma_avg`（实际能量分布）和 24 个模板逐一做**余弦相似度**：

```python
similarity = np.dot(chroma_avg, template) / (np.linalg.norm(chroma_avg) * np.linalg.norm(template))
```

相似度最高的模板对应的调就是检测结果。

**为什么用余弦相似度而不是欧氏距离？** 因为余弦相似度只关心方向（音的比例分布），不受整体响度影响——一首歌无论轻声还是大声演奏，chroma 的比例是一样的。

---

### `dynamic_range_db`（动态范围，单位 dB）

音频最响和最安静之间的**能量差**，单位分贝（dB）。

```python
rms = librosa.feature.rms(y=y)       # 逐帧 RMS 曲线
dynamic_range_db = 20 * np.log10(rms.max() / (rms.min() + 1e-9))
```

**为什么用 dB（对数）而不是线性比值？**

人耳感知响度是对数的：把音量翻倍，人听到的响度增加感觉是固定步长，而不是翻倍。所以用 dB 描述才和听感一致。

`20 * log10(x)` 是电压/振幅转 dB 的标准公式（功率转 dB 是 `10 * log10`）。

- 现代重度压缩流行歌：5–10 dB
- 古典交响乐 / 摇滚大作：20–40 dB
- Forever Love 示例值：**28.5 dB**（宽动态，安静引子到高潮鼓声落差大）

---

### `spectral_entropy`（频谱熵）

衡量音频**音色丰富程度**的指标。

#### 技术细节：Shannon 熵是什么？

**Shannon 熵**来自信息论，衡量一个概率分布的"不确定性"或"均匀程度"：

```
H = -Σ p(x) * log(p(x))
```

- 所有概率集中在一个点（确定性最高）：熵 = 0
- 所有可能均等分布（最不确定）：熵最大

**用在频谱上的含义：**

把每帧的频谱能量归一化成"概率分布"，然后算熵：

```python
mel = librosa.feature.melspectrogram(y=y, sr=sr)   # (128, T) — mel 频谱图
mel_norm = mel / (mel.sum(axis=0, keepdims=True) + 1e-9)   # 归一化，每帧 128 个值加和 = 1
spectral_entropy = -np.sum(mel_norm * np.log(mel_norm + 1e-9), axis=0).mean()
```

- 纯音（单个频率）：能量全在一点，熵接近 0
- 白噪声（所有频率均等）：熵最大
- 管弦乐 + 摇滚（复杂音色）：熵 4–5

Mel 频谱图的原理见前置节"什么是 Mel 频谱图"，这里直接用于计算中。

---

### `silence_ratio`（静音比例）

整首歌中 RMS 能量低于阈值（如 0.01）的帧占全部帧的比例。

- 密集摇滚：< 0.05
- 有呼吸感的古典：0.1–0.3
- Forever Love 示例值：**0.06**（整体密集，但保留了少量安静引子）

---

### `duration_sec`（时长，单位秒）

总时长。332.0 秒 = 5 分 32 秒。影响情感弧线数据点密度（时间越长，滑动窗口产生越多点）。

---

## 二、UnderstandingBundle — L2 理解层输出

这一层的结果既有**分类模型的判断**（流派、情感、乐器），也有**算法计算的结构信息**（和弦、段落、情感弧线）。

---

### `audio_id`（音频内容指纹）

在 UnderstandingBundle、AestheticBundle、AnalysisResult 里都有这个字段。它是上传文件内容的 **SHA-256 哈希值**，64 个十六进制字符。

```python
import hashlib
audio_id = hashlib.sha256(file_bytes).hexdigest()
# 同一个文件无论上传多少次，audio_id 永远相同
```

作用：内容寻址（content-addressed storage）的 key。

- Redis 缓存 key：`analysis:{audio_id}` → 同一首歌第二次上传直接命中缓存，跳过所有 ML 计算
- PostgreSQL `analyses` 表以 `audio_id` 为主键 → 同文件只存一行，`ON CONFLICT DO NOTHING` 防重复

示例值：`"mock-yoshiki-001"`（Mock 数据用的是易读名，真实值会是 64 位十六进制串）

---

### `genre` / `genre_confidence` / `genre_top3`（流派分类）

- `genre`：最高置信度的流派标签，如 `"Orchestral Rock"`
- `genre_confidence`：最高标签的置信度（0–1），如 **0.87**
- `genre_top3`：前三个候选

```json
[
  {"label": "Orchestral Rock", "confidence": 0.87},
  {"label": "Symphonic Metal", "confidence": 0.09},
  {"label": "Classical",       "confidence": 0.04}
]
```

三者加起来 ≈ 1.0（softmax 输出）。差距越大 = 模型越确定。

---

### `emotion_labels`（情感标签，多标签）

从预定义情感词库里选出的若干标签，描述这首歌的**主观情感色彩**。

示例值：`["dramatic", "intense", "melancholic"]`

与流派分类的区别：流派是单标签（只选一个），情感是多标签（可以同时成立多个）。技术实现上用 sigmoid + 阈值，而不是 softmax。

---

### `valence`（效价，-1.0 ~ 1.0）

情感的**正负方向**：正 = 愉悦，负 = 悲伤/痛苦。

源自心理学**情感二维模型（Valence-Arousal Model，Russell 1980）**：

```
高 arousal
     │  紧张/愤怒          激动/喜悦
     │       ●                  ●
─────┼─────────────────────────────── valence
 负  │  悲伤/沮丧          平静/满足
     │       ●                  ●
低 arousal
```

这两个维度**正交**（互相独立），可以覆盖所有情感状态：
- 慢速悲歌：低 arousal + 负 valence
- 愤怒金属：高 arousal + 负 valence（Forever Love 就在这个象限）
- 欢快舞曲：高 arousal + 正 valence
- 轻柔治愈：低 arousal + 正 valence

Forever Love 示例值：**-0.28**（带苦味，"永恒的爱"里有告别的哀伤）

---

### `arousal`（唤醒度，0.0 ~ 1.0）

情感的**激烈程度**：高 = 激动/兴奋，低 = 平静/沉默。

注意：与 valence 正交——"悲伤且激烈"完全合法，这正是悲剧摇滚的情感区间。

- 安静 ballad：0.1–0.3
- 激烈高潮段：0.9–1.0
- Forever Love 整体均值：**0.74**（整体高能）

---

### `tension` / `release` / `energy`

三个补充情感维度，都在 0.0–1.0 范围内：

| 字段 | 含义 | 高值特征 |
|------|------|---------|
| `tension` | 和声/节奏张力 | 不协和音程多、节奏密集、和弦未解决 |
| `release` | 张力释放程度 | 和弦从属到主的解决、节奏松弛 |
| `energy` | 综合能量感 | RMS 高 + 节奏密度高 |

示例值：tension **0.71**（高张力）、release **0.44**（中等释放）、energy **0.58**

---

### `emotion_arc`（情感弧线）

**滑动窗口**（sliding window）思路：以固定大小的窗口在音频上滑动，对每一窗口预测 valence + arousal，得到时间序列。

```python
# 伪代码（roadmap Stage 3 的实现思路）
window_sec = 5   # 每次分析 5 秒
hop_sec    = 15  # 每 15 秒取一个点（这里间隔不等，只是说明概念）

arc = []
for start in range(0, duration_sec - window_sec, hop_sec):
    segment = y[start*sr : (start+window_sec)*sr]
    feats = extract_clip_features(segment, sr)
    valence, arousal = emotion_model.predict(feats)
    arc.append({"timestamp_sec": start, "valence": valence, "arousal": arousal})
```

示例值（9 个采样点，覆盖 5 分 32 秒）：
```json
[
  {"timestamp_sec": 0,   "valence": -0.10, "arousal": 0.35},  ← 安静引子
  {"timestamp_sec": 65,  "valence": -0.30, "arousal": 0.95},  ← 高潮副歌
  {"timestamp_sec": 130, "valence": -0.15, "arousal": 0.98}   ← 最高潮
]
```

这条曲线是前端折线图的原始数据，也是 L3 计算 `valence_delta`、`arousal_std` 等情感深度 evidence 的来源。

---

### `time_signature`（拍号）

`"4/4"` 表示每小节 4 拍，每拍四分音符。

| 拍号 | 典型场景 |
|------|---------|
| 4/4 | 绝大多数流行/摇滚（强 - 弱 - 次强 - 弱） |
| 3/4 | 华尔兹（强 - 弱 - 弱） |
| 6/8 | 摇篮曲感（两组三拍） |
| 5/4、7/8 | Prog Rock 复合节拍（如 Pink Floyd） |

---

### `instruments`（乐器识别）

多标签分类，每条包含乐器名称和置信度。置信度独立计算（每个乐器单独判断"有没有"），不像 genre_top3 加和 = 1。

```json
[
  {"name": "piano",              "confidence": 0.92},
  {"name": "orchestral strings", "confidence": 0.88},
  {"name": "electric guitar",    "confidence": 0.81},
  {"name": "drums",              "confidence": 0.95},
  {"name": "brass",              "confidence": 0.73}
]
```

---

### `structure`（曲段结构）

把整首歌切成若干段，每段有起止时间和段落标签。

```json
[
  {"start_sec": 0,   "end_sec": 28,  "label": "intro"},
  {"start_sec": 28,  "end_sec": 62,  "label": "verse"},
  {"start_sec": 62,  "end_sec": 96,  "label": "chorus"}
]
```

#### 技术细节：自相似矩阵（SSM）是什么？怎么用它找段落边界？

**第一步：理解 SSM**

SSM（Self-Similarity Matrix，自相似矩阵）是一个 T×T 的矩阵，其中 `SSM[i][j]` = 第 i 帧和第 j 帧的**相似度**。

```python
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)  # (20, T)
S = librosa.segment.recurrence_matrix(mfcc, metric='cosine', mode='affinity', sym=True)
# S.shape = (T, T)
# S[i][j] = 帧i 和 帧j 的余弦相似度（0~1）
# metric='cosine'：只看 MFCC 向量方向，不受录音响度影响
# mode='affinity'：把距离转成相似度（距离越小 → 值越接近 1）
```

**直觉：SSM 的对角线之外的结构反映了音乐的重复模式。**

- 如果歌曲有两段 chorus，这两段的每一帧都和对方高度相似，SSM 上会出现**平行于主对角线的亮块**
- intro 和 outro 可能也相似，对应 SSM 角落的亮块

可视化：把 SSM 想象成一张地图，亮的地方 = 相似，暗的地方 = 不同。

```
帧序号 →
↓       intro  verse  chorus verse  chorus outro
intro   ████   ░░░░   ░░░░   ░░░░   ░░░░   ████
verse   ░░░░   ████   ░░░░   ████   ░░░░   ░░░░
chorus  ░░░░   ░░░░   ████   ░░░░   ████   ░░░░
verse   ░░░░   ████   ░░░░   ████   ░░░░   ░░░░
chorus  ░░░░   ░░░░   ████   ░░░░   ████   ░░░░
outro   ████   ░░░░   ░░░░   ░░░░   ░░░░   ████
```

**第二步：从 SSM 找边界（novelty curve）**

沿 SSM 主对角线滑动一个小方块（kernel），看这个方块两边的相似度：

- 如果方块跨越段落边界（一边是 verse，另一边是 chorus）：两边内容差异大，相似度低 → novelty 高
- 如果方块在段落内部：两边内容相似，novelty 低

novelty 曲线的**局部峰值**就是段落边界。

```python
novelty = librosa.segment.recurrence_to_lag(S).diagonal(offset=1)
peaks = librosa.util.peak_pick(novelty, ...)
boundaries = librosa.frames_to_time(peaks, sr=sr)
```

**为什么用 MFCC 计算 SSM 而不是原始波形？** MFCC 压缩了音色信息，同一段落（比如两段副歌）的音色分布高度相似，不同段落的差异会被放大。

---

### `chords`（和弦进行）

逐段标注和弦，每条包含起止时间和和弦名称。

```json
[
  {"start_sec": 0,  "end_sec": 4,  "chord": "Dm"},
  {"start_sec": 4,  "end_sec": 8,  "chord": "Bb"},
  {"start_sec": 8,  "end_sec": 12, "chord": "F"},
  {"start_sec": 12, "end_sec": 16, "chord": "C"}
]
```

**和弦命名规则：**

| 记号 | 含义 | 组成音 |
|------|------|--------|
| `Dm` | D 小三和弦 | D-F-A |
| `Bb` | 降B 大三和弦 | Bb-D-F |
| `F`  | F 大三和弦 | F-A-C |
| `C`  | C 大三和弦 | C-E-G |
| `Gm` | G 小三和弦 | G-Bb-D |
| `A`  | A 大三和弦 | A-C#-E |

**技术上怎么检测：chroma 模板匹配**

做法和 key 检测类似，但粒度更细——针对每一帧（或每隔几帧）做一次匹配：

```python
CHORD_TEMPLATES = {
    "C":  [1,0,0,0,1,0,0,1,0,0,0,0],   # C-E-G → 第0、4、7位
    "Dm": [1,0,0,1,0,0,0,1,0,0,0,0],   # D-F-A → 第2、5、9位
    ...
}

def recognize_chord(chroma_frame):
    # 余弦相似度：只看方向，不受帧整体响度影响
    def cosine_sim(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)

    sims = {name: cosine_sim(chroma_frame, np.array(tmpl)) for name, tmpl in CHORD_TEMPLATES.items()}
    return max(sims, key=sims.get)
```

逐帧识别后，把相邻相同和弦合并，持续 < 1s 的忽略（避免误判噪声）。

**Dm→Bb→F→C 的音乐含义：** 这是 D 小调的经典进行，覆盖了 T（主，Dm）、S（下属，Gm/Bb）、D（属，A/C）三种和声功能，形成完整的功能和声循环。

---

## 三、AestheticBundle — L3 美学评分层输出

L3 是**纯确定性计算**，没有模型，根据 L1+L2 的数值用公式算出四个维度的分数。

---

### `aesthetic_index`（综合美学指数，0–100）

四维加权平均：

```
aesthetic_index = (
  physical_precision  × 0.20 +
  structural_logic    × 0.20 +
  emotional_depth     × 0.30 +
  vital_tension       × 0.30
)
```

权重在 `weights` 字段显式存储，可被 Claude 引用。示例值：**86.1**

情感深度和生命张力权重更高（各 0.30），因为这两个维度更难通过技术手段伪造，更接近"可计算的美"的核心。

---

### 四个维度（`DimensionScore`）

每个维度都是同一结构：

```json
{
  "score": 84.0,
  "evidence": {"tempo_stability": 0.03, "dynamic_range_db": 28.5, ...}
}
```

`evidence` 是**可审计的数值链接**：Claude 解读时必须引用 evidence 里的具体数字，不能自行推断。这是 `verified: true` 的含义。

---

#### `physical_precision`（物理精确性）

衡量"精密度"：节拍稳、动态范围宽、频谱均衡。

| evidence 字段 | 含义 | 来源字段 | Forever Love |
|--------------|------|---------|-------------|
| `tempo_stability` | 拍间隔标准差（越小越好） | FeatureSummary | 0.03 |
| `dynamic_range_db` | 响度极差（越大越好） | FeatureSummary | 28.5 |
| `spectral_entropy` | 频谱熵（音色丰富度） | FeatureSummary | 4.2 |
| `frequency_balance` | 低中高频能量均衡度（接近1越均衡） | 计算自 mel | 0.76 |

---

#### `structural_logic`（结构逻辑）

衡量和声功能覆盖完整性 + 段落时长均衡性。

| evidence 字段 | 含义 | 来源 | Forever Love |
|--------------|------|------|-------------|
| `tsd_coverage` | T-S-D 三种和声功能覆盖率 | chords | 0.71 |
| `segment_balance` | 各段时长分布均衡度（接近1 = 均等） | structure | 0.83 |
| `key_stability` | 调性稳定性（是否频繁转调） | key + chroma | 0.88 |

**T-S-D 是什么：**

西方功能和声把所有和弦分成三类：
- **T（Tonic，主）**：稳定，"家"的感觉（C 大调中是 C 和弦）
- **S（Subdominant，下属）**：中间状态，离开家但还没远走（F 和弦）
- **D（Dominant，属）**：紧张，强烈倾向于回家（G7 和弦）

完整的和声进行 T→S→D→T 会产生"出发-紧张-解决"的闭环感。缺少任何一环，听感上就会不完整。`tsd_coverage = 0.71` 意味着 71% 的和声时间里三种功能都出现了。

---

#### `emotional_depth`（情感深度）

衡量情感弧线的起伏幅度和复杂性。

| evidence 字段 | 含义 | 计算方式 | Forever Love |
|--------------|------|---------|-------------|
| `valence_delta` | emotion_arc 里 valence 极差 | `max(v) - min(v)` | 1.13 |
| `polarity_switches` | valence 正负翻转次数 | `sum(v[i]*v[i-1] < 0)` | 5 |
| `arousal_std` | arousal 标准差 | `np.std(arousal_arc)` | 0.24 |
| `high_arousal_ratio` | arousal > 0.7 的时间占比 | `mean(arousal > 0.7)` | 0.42 |

`valence_delta = 1.13`：从 valence 最低点 -0.60（某段沉重段落）到最高点 +0.53，极差 1.13，接近理论上限 2.0 的一半——说明这首歌的情感跨度非常大。

`polarity_switches = 5`：valence 在正负之间切换了 5 次。每次切换对应一次"从悲到喜"或"从喜到悲"的戏剧性转折。

---

#### `vital_tension`（生命张力）

衡量能量爆发感：动态对比大、爆发密集。

| evidence 字段 | 含义 | 计算方式 | Forever Love |
|--------------|------|---------|-------------|
| `dynamic_contrast` | RMS 最大值与最小值之差 | `rms.max() - rms.min()` | 0.81 |
| `burst_density` | 每分钟 onset 峰值次数 | `len(peaks) / duration_min` | 11.4 |
| `silence_burst_ratio` | 静音段与爆发段的交替比 | 特定算法 | 0.08 |
| `dissonance_ratio` | 不协和音程占所有音程的比例 | 和弦分析 | 0.29 |

**什么是 onset（起音）？**

音乐中每当一个新的音符或击鼓出现时，能量会突然上升——这个突然上升的瞬间叫 onset。

```python
onset_strength = librosa.onset.onset_strength(y=y, sr=sr)
# 每帧的"能量突变强度"曲线
peaks, _ = scipy.signal.find_peaks(onset_strength, prominence=0.3)
# 找出突变明显的帧 = onset 位置
burst_density = len(peaks) / (duration_sec / 60)
```

`burst_density = 11.4` 意味着每分钟有 11.4 次能量爆发，平均每 5 秒一次——保持持续紧张感而不让听者疲劳。

**什么是不协和音程（dissonance）？**

两个音同时响起，音程（音高差）决定听感：
- 纯五度（7 个半音，如 C-G）：协和，稳定，好听
- 大三度（4 个半音，如 C-E）：协和，明亮
- 小二度（1 个半音，如 C-C#）：不协和，紧张，刺耳
- 增四度（6 个半音，tritone）：极度不协和，被称为"魔鬼音程"

`dissonance_ratio = 0.29` 说明 29% 的音程是不协和的——相当高，是生命张力的重要来源。

---

## 四、AnalysisResult — L4 Harness 输出

L4 把 L1-L3 的所有结果汇总，启动 Claude tool_use 循环，生成自然语言解读。

---

### `verified`（是否经过工具链验证）

布尔值。`true` 表示 summary 和 explanation 的内容来自真实工具调用，所有数字有 tool_call_log 可追溯。

意义：向用户承诺"这不是 Claude 胡编的数字"。

---

### `tool_call_count`（工具调用次数）

Stage 0 固定为 4（`explain_dimension × 4` 维度）。

---

### `tool_call_log`（工具调用记录）

完整的调用链，每条记录一次 tool_use：

```json
{
  "tool_name": "explain_dimension",
  "input": {
    "dimension": "vital_tension",
    "score": 91,
    "evidence": {"dynamic_contrast": 0.81, "burst_density": 11.4, ...}
  },
  "output": {
    "explanation": "生命张力得分 91：动态对比度 0.81..."
  },
  "duration_ms": 1850
}
```

- `input`：Claude 告诉工具"我要解读哪个维度、分数多少、证据是什么"
- `output`：工具返回的自然语言解释
- `duration_ms`：这次工具调用花了多少毫秒

---

### `summary`（总体结论，2–3 句）

对整首歌的高度概括，展示在 AI 解读 Tab 的 `AISummary` 组件。

---

### `explanation`（四维详细解读，Markdown 格式）

每个维度各一段，带 `**标题**` 标记。对应 `AIExplanation` 组件渲染。

---

### `conversation_context_id`（会话上下文 ID）

追问功能用的 ID。第一次分析完成后 Claude 保留完整的 tool_use 历史，用这个 ID 索引。用户追问时把 ID 传回，Claude 基于已有上下文回答，不重新跑 pipeline。

---

## 附：字段 → 代码位置速查

| 字段所在结构 | 定义文件 | Mock 数据文件 |
|------------|---------|-------------|
| `FeatureSummary` | `contracts/types.go / .ts / .py` | `apps/engine/mock/fixtures.py` |
| `UnderstandingBundle` | `contracts/types.go / .ts / .py` | `apps/engine/mock/fixtures.py` |
| `AestheticBundle` | `contracts/types.go / .ts / .py` | `apps/engine/mock/fixtures.py` |
| `AnalysisResult` | `contracts/types.go / .ts` | `apps/gateway/mock/fixtures.go` |
| `Job` | `contracts/types.go / .ts` | `apps/gateway/mock/fixtures.go` + `apps/web/mock/fixtures.ts` |
| L3 评分公式 | `doc/roadmap.md` Stage 4 | — |
| 四维权重设计理念 | `doc/product.md` | — |

## 附：技术概念速查

| 概念 | 一句话 | 出现在哪 |
|------|--------|---------|
| STFT | 逐帧做傅里叶变换，得到频谱图 | 所有频谱特征的基础 |
| Mel 频谱图 | 对 STFT 做人耳感知压缩（128 频带） | spectral_entropy、MFCC |
| MFCC | Mel 频谱图 → 取 log → DCT 压缩成 40 维音色指纹 | FeatureBundle、emotion 分类 |
| DCT | 离散余弦变换，把频带能量模式压缩成少量系数 | MFCC 计算第三步 |
| chroma | 把所有频率折叠到 12 个音类的能量分布 | key 检测、和弦识别 |
| RMS | 每帧振幅的均方根，代表响度 | dynamic_range_db、silence_ratio |
| spectral_centroid | 频谱能量的加权平均频率（"音色亮度"） | FeatureBundle 内部 |
| onset | 音符/击鼓引起的能量突变瞬间 | burst_density |
| SSM | 帧与帧之间的相似度矩阵，用于找段落边界 | structure |
| novelty curve | 沿 SSM 对角线的局部差异度曲线 | structure |
| audio_id | 文件内容的 SHA-256 哈希，内容寻址 key | 所有 bundle 的主键 |
| FeatureBundle | 引擎内部类型，含 numpy 数组，不跨服务 | L1→L2 内部传递 |
| FeatureSummary | FeatureBundle 的标量子集，wire-safe | L1 输出，跨服务传输 |
| valence | 情感正负方向（愉悦/悲伤）| emotion_arc |
| arousal | 情感激烈程度（兴奋/平静）| emotion_arc |
| T-S-D | 主/下属/属三种和声功能 | tsd_coverage |
| 不协和音程 | 听感紧张的音程（小二度、增四度等）| dissonance_ratio |
| 奈奎斯特定理 | 采样率至少是最高频率的两倍，22050Hz 覆盖可听范围 | sample_rate |
