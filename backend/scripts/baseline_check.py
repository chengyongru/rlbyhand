"""Standalone 8GB-VRAM GPU smoke test & baseline calibration script.

Run this first when testing on a real GPU at home:
    uv sync --extra gpu
    uv run python backend/scripts/baseline_check.py

Checks:
1. GPU device, recommended dtype (bf16 vs fp16), and initial VRAM headroom.
2. Few-shot Pass@1 and Pass@6 on 3-number Countdown (verifies 10%-30% RL sweet spot).
3. Batched rollout latency with `</answer>` early stopping.
4. 5-step micro-batched GRPO sanity run with `disable_adapter()` KL and peak VRAM report.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path

from llm_rl_lab.config import detect_device_telemetry
from llm_rl_lab.countdown import render_countdown_prompt, generate_countdown_dataset, verify_countdown
from llm_rl_lab.schema import StartTrainRequest
from llm_rl_lab.trainer import RealGPUTrainer


def evaluate_baseline(num_problems: int = 16, group_size: int = 6) -> None:
    import torch

    info = detect_device_telemetry(mock_mode=False)
    print("=== Device Telemetry ===")
    print(info.model_dump_json(indent=2))
    if not info.torch_available or not info.transformers_available or not info.peft_available:
        print("\nMissing GPU dependencies. Run: uv sync --extra gpu")
        return

    trainer = RealGPUTrainer()
    t0 = time.perf_counter()
    model, tokenizer, device, _ = trainer._ensure_model()
    print(f"\nLoaded model + LoRA on {device} in {time.perf_counter() - t0:.1f}s")

    problems = generate_countdown_dataset(size=num_problems, seed=123)
    pass1_hits = 0
    passk_hits = 0
    format_hits = 0
    total_samples = 0
    t_rollout = time.perf_counter()

    model.eval()
    model.config.use_cache = True
    for idx, prob in enumerate(problems):
        prompt = render_countdown_prompt(tokenizer, prob.numbers, prob.target)
        inputs = tokenizer([prompt] * group_size, return_tensors="pt", padding=True).to(device)
        prompt_len = inputs["input_ids"].shape[1]
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=256,
                do_sample=True,
                temperature=0.85,
                top_p=0.95,
                pad_token_id=tokenizer.pad_token_id,
            )
        texts = tokenizer.batch_decode(out[:, prompt_len:], skip_special_tokens=True)
        results = [verify_countdown(t, prob.numbers, prob.target) for t in texts]
        correct_flags = [r.numbers_valid and r.target_matched for r in results]
        pass1_hits += sum(correct_flags)
        passk_hits += int(any(correct_flags))
        format_hits += sum(1 for r in results if r.format_reward > 0)
        total_samples += group_size
        if idx == 0:
            print(f"\nSample prompt {prob.numbers} -> {prob.target} (ref: {prob.solution}):")
            print(f"  Completion[0]: {texts[0][:180]!r}")
            print(f"  Breakdown[0]:  {results[0].reason} (reward={results[0].total_reward})")

    elapsed = time.perf_counter() - t_rollout
    print("\n=== Baseline Calibration Results ===")
    print(f"Pass@1:      {pass1_hits / total_samples:.1%}  (target sweet spot: 10% - 30%)")
    print(f"Pass@{group_size}:      {passk_hits / num_problems:.1%}  (target: >= 45%)")
    print(f"Format rate: {format_hits / total_samples:.1%}")
    print(f"Rollout speed: {elapsed / num_problems:.2f}s / prompt (G={group_size})")
    if device == "cuda":
        print(f"Peak VRAM (eval): {torch.cuda.max_memory_allocated() / (1024**3):.2f} GB")

    print("\n=== Running 5-step GRPO Sanity Check ===")

    async def _sanity() -> None:
        cancel = asyncio.Event()

        async def _log(ev: dict) -> None:
            if ev["type"] == "step":
                m = ev["step"]["metrics"]
                print(
                    f"  step={m['step']} acc={m['accuracy']:.2f} reward={m['mean_reward']:.2f} "
                    f"len={m['mean_response_length']:.0f} kl={m['kl_divergence']:.4f} "
                    f"peak_vram={m['vram_peak_gb']:.2f}GB ({m['step_time_sec']:.1f}s)"
                )

        req = StartTrainRequest(preset_id="baseline_grpo", lesson_id="lesson-3", total_steps=5, group_size=group_size)
        await trainer.run(req, _log, cancel, Path("runs"))

    asyncio.run(_sanity())


if __name__ == "__main__":
    evaluate_baseline()
