# 05 · Home GPU Testing Guide

Use this checklist when you get home to your 8 GB GPU machine to validate real training, calibrate task difficulty, and optionally replace the synthetic demo curves with authentic GPU runs.

## Step 1: Environment Setup

```bash
git clone <your-private-repo-url>
cd llm-rl-lab

# Install Python backend + PyTorch / Transformers / PEFT
uv sync --extra gpu --extra dev

# Optional if HuggingFace Hub is slow from China:
export HF_ENDPOINT=https://hf-mirror.com

# Check detected GPU, VRAM, and recommended dtype
uv run llm-rl-lab info
```

Verify that `device_type` is `"cuda"` (or `"mps"`), `torch_available`, `transformers_available`, and `peft_available` are all `true`.

## Step 2: Run the Baseline Calibration & 5-Step Smoke Test

```bash
uv run python backend/scripts/baseline_check.py
```

What to inspect in the output:

1. **Initial `Pass@1` & `Pass@6`**: Ideally `Pass@1` is in **10%–30%** and `Pass@6 >= 45%`. If `Pass@1` is too low (< 8%), adjust `max_num=12` in `backend/llm_rl_lab/countdown.py:generate_countdown_dataset`. If too high (> 40%), try `max_num=20` or `allow_div=True`.
2. **Format Rate**: With the built-in 1-shot example, `Qwen2.5-0.5B-Instruct` should achieve > 80% valid `<think>/<answer>` tags right away.
3. **Peak VRAM (5-step GRPO)**: Confirm `peak_vram` stays under **6.0 GB** on an 8 GB card (leaving room for Windows/Linux desktop + browser). If VRAM exceeds 6.5 GB, reduce `micro_batch_size` from `2` to `1` in `backend/llm_rl_lab/trainer.py`.
4. **Step Latency**: Check `step_time_sec`. Target 4–10s per step at `G=6`, `max_new_tokens=256`.

## Step 3: Launch the Full Web Lab Against Your GPU

Terminal 1 (Backend):

```bash
uv run llm-rl-lab serve --no-browser
# Copy the printed Session Token
```

Terminal 2 (Frontend dev server, or build once into `backend/llm_rl_lab/static`):

```bash
cd frontend
npm install
npm run dev
# Open http://127.0.0.1:5173, click "Connect Local GPU", paste the token
```

Alternatively, build the frontend into the Python package once so a single command opens everything:

```bash
cd frontend && npm run build:backend && cd ..
uv run llm-rl-lab serve
```

## Step 4: Replace Demo Curves with Real GPU Runs (Optional)

Every local run automatically saves to `runs/gpu-<id>.json` in the exact `RunLog` schema.

1. Test the run visually by uploading it via **Telemetry -> Import GPU Run JSON**.
2. Once you have real GPU logs for the main presets (`baseline_grpo`, `no_format_reward`, `reward_shift_plus10`, `ppo_multi_epoch`, `kl_zero_collapse`, `reward_hacking`, `entropy_collapse`, `offline_dpo`), merge them into `frontend/src/data/demoRuns.json` (preserving keys matching `PRESETS`) so the static online version replays 100% authentic GPU experiments!

## Troubleshooting

- **CUDA OOM on Windows**: Close heavy browser tabs or set `micro_batch_size = 1` and `max_new_tokens = 192` in `trainer.py`.
- **`bfloat16` not supported error**: Override `recommended_dtype` to `"float16"` in `config.py` if using an older GPU driver.
- **Custom user code edits not yet wired into `RealGPUTrainer` loop**: Note that `sandbox.py` validates custom code on dummy tensors via `/api/dry-run`; to execute user-edited loss functions directly inside `RealGPUTrainer`'s backward loop, pass the compiled function from `sandbox.py` into step 4 of `RealGPUTrainer.run()` (left as an explicit hook so real GPU testing can verify baseline stability first).
