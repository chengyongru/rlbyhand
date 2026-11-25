# 01 · System Architecture

## Overview

`llm-rl-lab` uses a **Dual-Mode Local-First Web App** architecture so learners get zero-friction browser previews while GPU owners can execute live PyTorch training locally in 8 GB VRAM.

- **Mode A (Static Online Replay)**: The React SPA ships with `frontend/src/data/demoRuns.json`, generated directly from the backend Pydantic models (`llm-rl-lab generate-demo`). Learners can read all 6 bilingual lessons, inspect step-by-step rollouts and token heatmaps, lock predict-before-run hypotheses, and scrub curves with zero backend setup.
- **Mode B (Local 8 GB GPU Execution)**: Running `uv run llm-rl-lab serve` launches a FastAPI + WebSocket server bound strictly to `127.0.0.1:8765`. The browser connects using a per-session random token, submits surgical code edits for 1-second dry-run tensor checks, starts/stops local PyTorch runs, and streams `StepLog` events live over WebSocket.

## Repository Layout

```text
llm-rl-lab/
├── pyproject.toml                   # uv / hatchling package (`llm-rl-lab` CLI)
├── backend/
│   ├── llm_rl_lab/
│   │   ├── cli.py                   # `serve`, `generate-demo`, `info`
│   │   ├── config.py                # Experiment presets + CUDA/MPS/CPU detection
│   │   ├── schema.py                # Single-source Pydantic schema for runs & API
│   │   ├── countdown.py             # Generator, AST safe eval, two-stage RLVR verifier
│   │   ├── algorithms.py            # Chunked log_prob/entropy, REINFORCE, GRPO, DPO
│   │   ├── trainer.py               # RealGPUTrainer (8GB PyTorch) + MockTrainer (CPU)
│   │   ├── sandbox.py               # 1-second AST + dummy-tensor Dry-Run validator
│   │   ├── server.py                # FastAPI REST + WebSocket + static SPA hosting
│   │   └── demo_data.py             # Generates `frontend/src/data/demoRuns.json`
│   ├── scripts/baseline_check.py    # First script to run on real GPU hardware
│   └── tests/                       # Pytest unit and integration tests
├── frontend/
│   └── src/
│       ├── types/lab.ts             # TypeScript mirror of `schema.py`
│       ├── i18n/                    # Complete ZH / EN UI strings & 6-lesson syllabus
│       ├── store/useLabStore.ts     # Zustand global store
│       ├── api/client.ts            # REST + WebSocket + browser dry-run helper
│       └── components/              # Mantine v7 + Recharts + Monaco + KaTeX views
└── dev-docs/                        # Internal dev documentation (safe to delete)
```

## Single-Package Distribution (`uvx` Ready)

During development, Vite serves the frontend on port `5173` and proxies `/api` and `/ws` to FastAPI on `127.0.0.1:8765`. For single-command distribution, `cd frontend && npm run build:backend` builds the static bundle into `backend/llm_rl_lab/static/`. FastAPI detects `static/index.html` and serves the SPA directly so end users only run `llm-rl-lab serve`.

## Security Model for Local Execution

Because the Code Lab allows editing Python functions executed on the user's machine, four layers protect the local backend:

1. **Loopback binding only**: `uvicorn` binds strictly to `127.0.0.1`, never `0.0.0.0`.
2. **Per-session random token**: Every `serve` invocation generates a 24-byte `secrets.token_urlsafe` token checked via `secrets.compare_digest` on all `/api/*` (except `/api/health`) and `/ws/train`.
3. **Strict CORS allowlist**: Only `localhost` / `127.0.0.1` ports `5173` and `8765` are allowed.
4. **AST safety gate in `sandbox.py`**: Rejects `os`, `sys`, `subprocess`, `socket`, `eval()`, `exec()`, `open()`, and `__import__()` before executing user loss or reward snippets.
