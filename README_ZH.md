<!-- TODO: 把封面图放到 assets/cover.png -->
<div align=center><img src="assets/cover.jpg" width="256px;" alt="Computable Beauty"></div>
<p align='center'>音乐的美，可以被计算吗？<br>上传一段音乐，把物理层、结构层、情感层、生命层这四维美学直觉，翻译成可计算、可验证的维度</p>

## README 🌍
- [ [English](./README.md) ] | [ [简体中文](./README_ZH.md) ]

## 产品演示 🎵

> TODO：演示视频占位

## 产品介绍 ❤️

### 产品概述
- Computable Beauty 是一个 AI 音乐美学分析系统：上传一段音乐（MP3/WAV/FLAC/OGG），运行一套四层分析流水线：
  1. **声学特征提取** — 从音频波形中计算频谱、节拍网格、调式音高分布与动态包络，生成基础特征向量
  2. **多任务语义分类** — 并行推理流派归属、情感效价与唤醒度、乐器构成，同步检测和弦进行、调式与段落边界
  3. **四维美学评分** — 基于声学指标与分类结果，量化物理精确性、结构逻辑、情感深度、生命张力四个维度，合成综合美学指数
  4. **AI 循证解读** — 以前序各层的结构化输出为证据，由语言模型生成与数据严格对应的文字分析，每项结论均可回溯至具体指标
- 分析完成后，点击查看结果会跳转到结果页，结果页分 5 个 Tab：
  - **概览** — BPM、调性、节拍、乐器、风格、情绪等核心指标一览
  - **结构分析** — 完整的段落分段与和弦进行
  - **情感分析** — 情感弧线图，以及唤醒度、效价、张力、释放度、能量五个维度的详细说明
  - **美学分析** — 物理精确性、结构逻辑、情感深度、生命张力四维评分，及每项评分背后的具体证据指标
  - **AI 分析** — 基于前序数据生成的文字解读，可继续追问

### 产品特性
- 本地部署，音乐文件始终保留在用户本地，仅分析产出的结构化指标会发送至 LLM，音乐版权与隐私始终可控
- AI 分析支持关闭：未配置 OpenAI Key 时仅运行声学特征、语义分类、美学评分三层，数据完全保留在本地
- 声学特征 → 语义分类 → 美学评分 → AI 解读，四层流水线一次性执行完成、环环相扣，不是孤立的单点工具
- AI 解读强制执行工具调用循环，每条结论均须引用前序层的真实指标作为证据，不允许模型凭空编造数字
- 界面语言可在中英文间切换，AI 解读与后续追问均跟随当前语言输出，不会出现中英混杂
- 同一首歌分析过一次即会缓存，重复上传无需重新分析；但中英文各自维护一份缓存，切换语言会触发重新分析

## 本地部署 🚀

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
> 中国大陆用户在构建时可能会遇到 `go mod download` / `apt-get` 网络超时，需要手动编辑两个文件，改用国内镜像源：
> 1. 文件 `apps/gateway/Dockerfile` 中，把 `# ENV GOPROXY="https://goproxy.cn,direct"` 这一行开头的注释符号 `#` 去掉。
> 2. 文件 `apps/engine/Dockerfile` 中，把 `# RUN (sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true)` 和 `# && (sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list 2>/dev/null || true)` 这两行开头的注释符号 `#` 都去掉。
> 3. 如果 `uv sync` 下载 torch/scikit-learn 等大体积依赖时超时，在文件 `apps/engine/Dockerfile` 中，把 `# ENV UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"` 这一行开头的注释符号 `#` 去掉。

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

启动各服务：

```bash
cd apps/engine && uv run main.py # Engine 服务
cd apps/gateway && go run ./cmd # Gateway 服务
cd apps/web && npm install && npm run dev # Web 服务
```

提交前，在各服务目录下运行 `make lint`：

```bash
cd apps/engine && make lint
cd apps/gateway && make lint
cd apps/web && make lint
```

## 问题反馈 😥
- 如有问题或建议，欢迎通过邮件联系：[shanglin@zju.edu.cn](mailto:shanglin@zju.edu.cn)

## 特别说明 ⚠️
- 如您的项目涉及任何商业行为或者商业收益，欢迎在使用 Computable Beauty 前通过邮件（[shanglin@zju.edu.cn](mailto:shanglin@zju.edu.cn)）联系作者并标明出处！

## 许可证 📄

[Apache License 2.0](LICENSE)
