<!-- TODO: drop the cover image at assets/cover.png -->
<div align=center><img src="assets/cover.jpg" width="256px;" alt="Computable Beauty"></div>
<p align='center'>Can the beauty of music be computed?<br>Upload a piece of music, and translate the physical, structural, emotional, and vital layers of aesthetic intuition into computable, verifiable dimensions.</p>

## README 🌍
- [ [English](./README.md) ] | [ [简体中文](./README_ZH.md) ]

## Demo 🎵

> TODO: demo video placeholder

## Product Introduction ❤️

### Overview
- Computable Beauty is an AI music aesthetics analysis system: upload a piece of music (MP3/WAV/FLAC/OGG) and it runs a four-layer analysis pipeline:
  1. **Acoustic feature extraction** — computes spectrum, beat grid, key/pitch distribution, and dynamic envelope from the waveform, producing the base feature vector
  2. **Multi-task semantic classification** — infers genre, valence/arousal, and instrumentation in parallel, while detecting chord progressions, key, and section boundaries
  3. **Four-dimensional aesthetic scoring** — quantifies physical precision, structural logic, emotional depth, and vital tension based on the acoustic and classification results, and combines them into an overall aesthetic index
  4. **AI evidence-based interpretation** — an LLM generates a written analysis grounded in the structured output of the previous layers, with every conclusion traceable back to a specific metric
- Once analysis finishes, clicking through to the result takes you to the result page, which has 5 tabs:
  - **Overview** — a snapshot of the core metrics: BPM, key, time signature, instruments, genre, mood
  - **Structure** — the full section breakdown and chord progression
  - **Emotion** — the emotional arc chart, plus a detailed breakdown of arousal, valence, tension, release, and energy
  - **Aesthetic** — the four-dimensional score (physical precision, structural logic, emotional depth, vital tension) and the concrete evidence metrics behind each score
  - **AI Analysis** — a written interpretation grounded in the previous layers' data, with follow-up questions supported

### Features
- Self-hosted — your music files stay entirely on your own machine; only the structured metrics produced by analysis are sent to the LLM, keeping music copyright and privacy fully under your control
- AI analysis can be turned off entirely: without an OpenAI key configured, only the acoustic feature, classification, and aesthetic scoring layers run, and no data ever leaves your machine
- Acoustic features → classification → aesthetic scoring → AI interpretation: the four layers run as one connected pipeline, not a collection of isolated point tools
- AI interpretation is forced through a tool-calling loop — every conclusion must cite a real metric from an earlier layer as evidence, the model is never allowed to invent numbers
- The interface language can be switched between Chinese and English; AI interpretation and follow-up chat both respond in whichever language is currently selected, with no mixed-language output
- A track is cached the first time it's analyzed, so re-uploading it skips re-running the pipeline — though Chinese and English each keep their own cache, so switching language triggers a fresh analysis

## Local Deployment 🚀

### Requirements
Requires [Docker](https://docs.docker.com/get-docker/) (with the Compose plugin): macOS/Windows can just install [Docker Desktop](https://www.docker.com/products/docker-desktop/); Linux should install Docker Engine + the Compose plugin per the [official docs](https://docs.docker.com/engine/install/) for your distribution
> macOS users may prefer [OrbStack](https://orbstack.dev/) over Docker Desktop (requires macOS 14+): faster, lighter on resources, fully CLI-compatible — `brew install orbstack`, or [download the installer](https://orbstack.dev/download); launch it once after installing and `docker`/`docker compose` work out of the box

### Deploy

```bash
git clone <this-repo-url>
cd computable-beauty
```

Two ways to deploy, pick one:

- `./deploy-build.sh` — builds all three service images locally, then starts them. Use this if you have local code changes, or just want to verify the latest source; build time depends on your network (see the China mirror notes below if it's slow)
- `./deploy-pull.sh` — pulls prebuilt images from the GitHub Container Registry (`ghcr.io`) instead of building locally, up and running in seconds. Runs whatever CI last built on `main`, not your local uncommitted changes

China mirror notes for `./deploy-build.sh`'s local build:
> If you're building from mainland China, you may hit `go mod download` / `apt-get` network timeouts — manually edit two files to switch to China mirrors:
> 1. In `apps/gateway/Dockerfile`, delete the leading `#` comment marker from this line: `# ENV GOPROXY="https://goproxy.cn,direct"`
> 2. In `apps/engine/Dockerfile`, delete the leading `#` comment marker from these two lines: `# RUN (sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true)` and `# && (sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list 2>/dev/null || true)`
> 3. If `uv sync` times out downloading large dependencies like torch/scikit-learn, in `apps/engine/Dockerfile`, delete the leading `#` comment marker from this line: `# ENV UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"`

On first run, the script asks for three OpenAI-related settings (API Key / Base URL / Model) in turn — press Enter to skip any of them. Skipping still leaves the app fully usable, just without AI analysis; rerun the same script anytime to fill them in:

```
OpenAI API Key (powers AI analysis — press Enter to skip, you can rerun this script later to add it):
OpenAI Base URL (required for AI analysis, e.g. https://api.openai.com/v1 — press Enter to skip for now):
OpenAI Model (required for AI analysis, e.g. gpt-4o-mini — press Enter to skip for now):
```

The script then automatically:

- Generates `.env` (Docker network config + random passwords/secrets) — no manual file editing needed
- Checks all 5 ports (Web/Gateway/Engine/Postgres/Redis) for conflicts and bumps to the next free one automatically
- Streams the deploy output to the terminal while also writing it to `logs/deploy-<timestamp>.log`
- Keeps writing to `logs/runtime-<timestamp>.log` (per-container logs) after startup — `tail -f` to follow
- Prints the final URL when done

```
✅ Deploy complete
   URL:         http://localhost:3000
   Runtime log: logs/runtime-20260806-104500.log (still being written — tail -f to follow)
   Stop:        scripts/stop.sh
```

Open the printed URL in your browser to use it.

> Redeploying — whether after a code update or just running it again — also only takes the same script; there's no need to run `stop.sh`/`reset.sh` manually first. When the script detects an existing deployment, it prompts in red whether to wipe everything and start fresh, requiring confirmation twice before it actually wipes (equivalent to running `reset.sh --force`); without both confirmations, it defaults to running `stop.sh` to stop the old containers, keeping `.env` and your data, then continues deploying.
>
> `deploy-build.sh` always rebuilds the images from the current source, so code updates take effect automatically; `deploy-pull.sh` always re-pulls the latest `:latest` image, i.e. whatever CI last built.

### Stop
- Stop only: `./scripts/stop.sh`

Stops all containers. Historical logs stay in `logs/`, and data volumes (database, uploaded audio) are untouched — your data is still there next time you run `./deploy-build.sh`/`./deploy-pull.sh`.

- Stop and wipe everything: `./scripts/reset.sh`

Stops and removes all containers, networks, locally built images, and all data volumes (database, Redis, uploaded audio), plus `.env` and the `logs/` directory. Prompts for a `y` confirmation first; pass `-f`/`--force` to skip it.

## Development Guide 🛠️

### Requirements
- Docker (with the Compose plugin)
- Go 1.26+
- uv (Python 3.12+)
- Node.js 20.9+

### Local Debug
- Postgres/Redis run in Docker
- Engine/Gateway/Web all run directly on the host
- `docker-compose.base.yml` (fully containerized integration of all three services) is for verifying the containerized deployment itself — local debugging is recommended for day-to-day development

Local dev environment variables:

```bash
# Edit .env.local and fill in or adjust the relevant variables
cp .env.example .env.local
```

Start the Postgres and Redis services:

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

Start each service:

```bash
cd apps/engine && uv run main.py # Engine service
cd apps/gateway && go run ./cmd # Gateway service
cd apps/web && npm install && npm run dev # Web service
```

Before committing, run `make lint` in each service's directory:

```bash
cd apps/engine && make lint
cd apps/gateway && make lint
cd apps/web && make lint
```

## Feedback 😥
- If you have questions or suggestions, feel free to reach out by email: [shanglin@zju.edu.cn](mailto:shanglin@zju.edu.cn)

## Special Notice ⚠️
- If your project involves any commercial use or commercial revenue, please contact the author by email ([shanglin@zju.edu.cn](mailto:shanglin@zju.edu.cn)) before using Computable Beauty, and credit the source!

## License 📄

[Apache License 2.0](LICENSE)
