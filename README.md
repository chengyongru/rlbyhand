# LLM RL Lab

An interactive web-based reinforcement learning lab designed for undergraduate math prerequisites (calculus, linear algebra, probability) and local 8 GB VRAM GPUs.

Built around a single lightweight model organism — `Qwen2.5-0.5B-Instruct` + LoRA on 3-number Countdown — across six lessons covering `log_prob`, REINFORCE, GRPO, PPO clipping + Schulman k3 KL, common failure modes (reward hacking, entropy collapse, length drift), and offline DPO vs. online GRPO.

## Modes

- **Online Replay (Static Web)**: Browse all six bilingual (ZH / EN) lessons, inspect step-by-step rollouts and token probabilities, complete predict-before-run ablations, and compare recorded GPU runs without a backend. See the [experiment results](experiments/countdown-replay.md) for sample counts, settings, and limitations.
- **Local GPU Lab (`8 GB VRAM`)**: Launch the local FastAPI + PyTorch backend to run training presets and stream metrics over WebSocket. The code editor checks edits on test tensors; it does not replace the live loss. Offline DPO requires the recording script and a frozen preference dataset.

## Quick Start

### Frontend (Online Replay / Development)

```bash
cd frontend
npm install
npm run dev
```

### Local Backend (CPU Mock Mode for UI Testing)

```bash
uv sync --extra dev
uv run llm-rl-lab serve --mock
```

### Local Backend (Real 8 GB GPU Mode)

```bash
uv sync --extra gpu
# 1. Verify VRAM headroom, initial Pass@1/Pass@6, and rollout speed
uv run python backend/scripts/baseline_check.py
# 2. Launch interactive web lab bound to 127.0.0.1
uv run llm-rl-lab serve
```

> Internal development documentation lives in `dev-docs/` and can be removed cleanly (`rm -rf dev-docs`) before public release.
