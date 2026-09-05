<!-- TODO: 把封面图放到 assets/cover.png -->
<div align=center><img src="assets/cover.jpg" width="256px;" alt="Computable Beauty"></div>
<p align='center'>音乐的美，可以被计算吗？<br>上传一段音乐，把精确的节奏结构（物理层）、严谨考究的编曲逻辑（结构层）、直面情绪起伏的深度（情感层）、张弛分明的能量起伏（活力层），翻译成可计算的维度</p>

## README 🌍
- [ [English](./README.md) ] | [ [简体中文](./README_ZH.md) ]

## 产品演示 🎵

https://github.com/user-attachments/assets/aa1c69ee-2891-4866-bb5d-ff6980cc3d52

## 产品介绍 ❤️

### 产品概述
- Computable Beauty 是一个 AI 音乐美学分析系统：上传一段音乐（MP3/WAV/FLAC/OGG），运行一套四层分析流水线：
  1. **声学特征提取** — 从音频波形中计算频谱、节拍网格、调式音高分布与动态包络，生成基础特征向量
  2. **多任务语义分类** — 并行推理流派归属、情感效价与唤醒度、乐器构成，同步检测和弦进行与段落边界
  3. **四维美学评分** — 基于声学指标与分类结果，独立量化物理精确性、结构逻辑、情感深度、活力张力四个维度，四维独立展示，不合成综合指数
  4. **AI 循证解读** — 以前序各层的结构化输出为证据，由语言模型生成与数据严格对应的文字分析，每项结论均可回溯至具体指标
- 分析完成后，点击查看结果会跳转到结果页，结果页分 5 个 Tab：
  - **概览** — BPM、调性、节拍、乐器、风格、情绪等核心指标一览
  - **结构分析** — 完整的段落分段与和弦进行
  - **情感分析** — 情感弧线图，以及唤醒度、效价、张力、释放度、能量五个维度的详细说明
  - **美学分析** — 物理精确性、结构逻辑、情感深度、活力张力四维评分，及每项评分背后的具体证据指标
  - **AI 分析** — 基于前序数据生成的文字解读，可继续追问

### 更多功能
- **导出记录** — 支持导出全部历史为多工作表 Excel（概览、风格/乐器排名、美学证据、情感弧线、段落、和弦、AI 工具调用日志）
- **美学对比** — 可勾选最多 20 首历史分析进行美学四维并排对比
- **结果导出** — 结果页支持下载单首分析结果为 JSON
- **上传排队** — 批量上传时，页面实时显示每首歌的处理步骤与前方排队位置

### 产品特性
- 本地部署，音乐文件始终保留在用户本地，仅分析产出的结构化指标会发送至 LLM，音乐版权与隐私始终可控
- AI 分析支持关闭：未配置 OpenAI Key 时仅运行声学特征、语义分类、美学评分三层，数据完全保留在本地
- 声学特征 → 语义分类 → 美学评分 → AI 解读，四层流水线一次性执行完成、环环相扣，不是孤立的单点工具
- AI 解读强制执行工具调用循环，每条结论均须引用前序层的真实指标作为证据，不允许模型凭空编造数字
- 界面语言可在中英文间切换，AI 解读与后续追问均跟随当前语言输出，不会出现中英混杂
- 同一首歌分析过一次即会缓存，重复上传无需重新分析；但中英文各自维护一份缓存，切换语言会触发重新分析

## 本地部署 🚀

### 视频演示

**本地构建**（`deploy-build.sh`）：

https://github.com/user-attachments/assets/c5d27463-e13c-4c6c-9b8d-288499e00051

**基于镜像**（`deploy-pull.sh`）：

https://github.com/user-attachments/assets/01403571-0656-4154-967a-5f886bd1594f

### 环境需求
需要 [Docker](https://docs.docker.com/get-docker/)（含 Compose 插件）：macOS/Windows 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 即可；Linux 参照[官方文档](https://docs.docker.com/engine/install/)按发行版安装 Docker Engine + Compose 插件
> macOS 用户推荐使用 [OrbStack](https://orbstack.dev/) 代替 Docker Desktop（需要 macOS 14+），更快更省资源、命令行完全兼容：`brew install orbstack`，或从[官网下载](https://orbstack.dev/download)安装包，安装完成后启动一次即可，`docker`/`docker compose` 命令开箱可用

### 部署服务

```bash
git clone <this-repo-url>
cd computable-beauty
```

两种部署方式，二选一：

- `./deploy-build.sh` —— 本地构建三个服务的镜像后启动。有本地代码改动、想直接验证最新代码时用这个；构建耗时取决于本机网络（国内网络较慢的话见下面的镜像加速说明）
- `./deploy-pull.sh` —— 直接从 GitHub Container Registry（`ghcr.io`）拉取 CI 构建好的镜像启动，不用本地构建，速度较快；跑的是 `main` 分支最后一次 CI 构建出的版本，不包含你本地未提交的改动

`./deploy-build.sh` 本地构建时的镜像加速说明：
> 中国大陆用户在构建时可能会遇到 `go mod download` / `apt-get` / GitHub / `uv sync` 连接问题。`./deploy-build.sh` 一开始就会问"是否在中国大陆构建？"，回答 `y` 即可自动把 Go modules、apt、PyPI、git 的 HTTP 版本都切到国内镜像，不需要手动改文件。

首次运行会依次询问三个 OpenAI 相关配置（API Key / Base URL / Model），均可直接回车跳过——跳过后应用正常可用，只是 AI 分析不可用，可随时重新运行同一个脚本补填：

```
OpenAI API Key (powers AI analysis — press Enter to skip, you can rerun this script later to add it):
OpenAI Base URL (required for AI analysis, e.g. https://api.openai.com/v1 — press Enter to skip for now):
OpenAI Model (required for AI analysis, e.g. gpt-4o-mini — press Enter to skip for now):
```

脚本自动处理：

- 生成 `.env`（docker 网络配置 + 随机密码/密钥），无需手动编辑任何文件
- 检测 5 个端口（Web/Gateway/Engine/Postgres/Redis）是否被占用，冲突时自动 +1 递增直至找到空闲端口
- 部署过程实时输出于终端，同时写入 `logs/deploy-<时间戳>.log`
- 启动后持续写入 `logs/runtime-<时间戳>.log`（各容器日志），可通过 `tail -f` 查看
- 完成后打印最终访问地址

```
✅ Deploy complete
   URL:         http://localhost:3000
   Runtime log: logs/runtime-20260806-104500.log (still being written — tail -f to follow)
   Stop:        scripts/stop.sh
```

在浏览器中访问打印出的地址即可使用。

> 无论是代码更新后重新部署，还是单纯再次运行，同样只需执行同一个脚本，无需预先手动执行 `stop.sh`/`reset.sh`。脚本检测到已存在部署时，会以红色文字提示是否清空全部数据并重新开始，需连续确认两次方可清空（等效于执行 `reset.sh --force`）；未确认则默认执行 `stop.sh` 停止旧容器，`.env` 与数据保留，随后继续部署流程。
>
> `deploy-build.sh` 每次都会用最新代码重新构建镜像，代码更新自动生效；`deploy-pull.sh` 每次都会重新拉取最新的 `:latest` 镜像，跑的是 CI 上一次构建的版本。

### 停止服务
- 仅停止服务：`./scripts/stop.sh`

停止全部容器，历史日志保留在 `logs/` 目录，数据卷（数据库、已上传音频）不受影响，下次执行 `./deploy-build.sh`/`./deploy-pull.sh` 时数据依然存在。

- 停止且清空环境：`./scripts/reset.sh`

停止并删除所有容器、网络、本地构建的镜像、全部数据卷（数据库、Redis、已上传音频），以及 `.env`、`logs/` 目录，执行前需输入 `y` 确认，加 `-f`/`--force` 参数可跳过确认。

## 开发指南 🛠️

### 环境需求
- Docker（含 Compose 插件）
- Go 1.26+
- uv（Python 3.12+）
- Node.js 20.9+

### 本地调试
- Postgres/Redis 运行在 Docker 中
- Engine/Gateway/Web 均直接在宿主机运行
- `docker-compose.base.yml`（三个服务全容器化联调）用于验证容器化部署本身，日常开发建议使用本地调试

本地开发环境变量：

```bash
# 编辑 .env.local，填写或修改对应的变量
cp .env.example .env.local
```

启动 Postgres 和 Redis 服务：

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

下载流派/乐器/情感预训练模型：

```bash
cd apps/engine && make models
```

启动各服务：

```bash
cd apps/engine && make run # Engine 服务
cd apps/gateway && make run # Gateway 服务
cd apps/web && npm install && make run # Web 服务
```

提交前，在各服务目录下运行 `make lint`：

```bash
cd apps/engine && make lint
cd apps/gateway && make lint
cd apps/web && make lint
```

### 批量上传

批量上传指定目录下所有音频文件：

```bash
uv run scripts/upload.py /path/to/songs
uv run scripts/upload.py /path/to/songs --language en --base-url http://localhost:3000
```

- 按内容哈希跳过已经分析过的文件（上传前先查一遍历史记录），重复跑同一批文件不会产生重复任务
- 单次最多上传 100 首，超过会直接终止、不上传任何文件，提示拆成更小的批次分批跑
- 只依赖 Python 标准库，`uv run` 直接执行即可，不需要额外装依赖

## 问题反馈 😥
- 如有问题或建议，欢迎通过邮件联系：[shanglin@zju.edu.cn](mailto:shanglin@zju.edu.cn)

## 特别说明 ⚠️
- 如您的项目涉及任何商业行为或者商业收益，欢迎在使用 Computable Beauty 前通过邮件（[shanglin@zju.edu.cn](mailto:shanglin@zju.edu.cn)）联系作者并标明出处！

## 许可证 📄

[Apache License 2.0](LICENSE)
