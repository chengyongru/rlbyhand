"""Deterministic generator for realistic pre-recorded experiment runs (Mode A static replay).

Every preset uses the exact Pydantic `RunLog` schema produced by the real 8GB GPU trainer,
including authentic Countdown prompts, group rollouts, reward breakdowns, zero-gradient steps,
and token-level probability/entropy/KL distributions for the Microscope heatmap.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from .config import PRESETS
from .countdown import CountdownProblem, generate_countdown_dataset, verify_countdown
from .schema import (
    RunLog,
    RunMetadata,
    SampleRollout,
    StepLog,
    StepMetrics,
    TokenCandidate,
    TokenProbInfo,
)


def _make_token_probs(
    rng: random.Random,
    answer_expr: str,
    target: int,
    entropy_level: float,
    kl_level: float,
    advantage: float,
) -> list[TokenProbInfo]:
    """Synthesize plausible per-token probability & Top-5 candidate data for the Microscope heatmap."""
    tokens = [
        "<think>",
        " Try",
        " combining",
        " the",
        " largest",
        " numbers",
        " first:",
        f" {answer_expr}",
        " =",
        f" {target}",
        ".",
        " Check",
        " count:",
        " all",
        " used",
        " once.",
        "</think>",
        "<answer>",
        f"{answer_expr}",
        "</answer>",
    ]
    alts_pool = [
        [" +", " -", " *", " (", " /"],
        [" Try", " Let's", " First", " Check", " Start"],
        [" combining", " multiplying", " adding", " testing", " pairing"],
        [" largest", " smallest", " first", " two", " three"],
        [" =", " ->", " gives", " is", " equals"],
    ]

    result: list[TokenProbInfo] = []
    for idx, tok in enumerate(tokens):
        is_tag = tok.startswith("<") or tok.endswith(">")
        is_decision = idx in (1, 4, 7, 9, 18)
        base_p = 0.94 if is_tag else (max(0.22, 0.85 - entropy_level * 0.42) if is_decision else 0.78)
        p = min(0.99, max(0.14, base_p + rng.uniform(-0.08, 0.06)))
        ent = max(0.03, entropy_level * (1.35 if is_decision else (0.18 if is_tag else 0.65)) + rng.uniform(-0.04, 0.04))
        tok_kl = max(0.0, kl_level * (1.5 if is_decision else 0.35) + rng.uniform(-0.005, 0.01))

        rem = max(0.01, 1.0 - p)
        pool = alts_pool[idx % len(alts_pool)]
        cands = [TokenCandidate(token=tok, prob=round(p, 4))]
        weights = [0.46, 0.26, 0.16, 0.12]
        for alt, w in zip(pool[:4], weights):
            if alt != tok:
                cands.append(TokenCandidate(token=alt, prob=round(rem * w, 4)))

        result.append(
            TokenProbInfo(
                token=tok,
                prob=round(p, 4),
                log_prob=round(math.log(p), 4),
                entropy=round(ent, 4),
                kl=round(tok_kl, 4),
                advantage=round(advantage, 3),
                top_candidates=cands[:5],
            )
        )
    return result


def _synthesize_completion(
    rng: random.Random,
    problem: CountdownProblem,
    *,
    is_correct: bool,
    is_hack: bool,
    is_gibberish: bool,
    has_format: bool,
    step_ratio: float,
) -> tuple[str, str, str, int]:
    a, b, c = problem.numbers
    t = problem.target

    if is_gibberish:
        think = f"try {a}*{b}+{c} wait {a}+{b}+{c}=={t} == {t} {t} ### repeat {a}*{c} {a}*{c} ..."
        ans = f"{a} * {b} + {c} + {t}"
        raw = f"<think>{think}</think>\n<answer>{ans}</answer>"
        return raw, think, ans, rng.randint(155, 245)

    if is_hack:
        think = f"Target is {t}. Direct expression {t} evaluates to {t}."
        ans = str(t)
        raw = f"<think>{think}</think>\n<answer>{ans}</answer>"
        return raw, think, ans, rng.randint(24, 42)

    if not has_format:
        think = f"Maybe {a} * {b} - {c} = {a * b - c}, no, try {problem.solution} = {t}"
        raw = f"Let me calculate: {problem.solution} equals {t}."
        return raw, think, "", rng.randint(28, 55)

    if is_correct:
        if step_ratio > 0.35 and rng.random() < 0.7:
            wrong1 = a + b + c
            wrong2 = a * b + c
            think = (
                f"Try {a} + {b} + {c} = {wrong1}, too far from {t}. "
                f"Wait, check {a} * {b} + {c} = {wrong2}. "
                f"Re-evaluate: {problem.solution} = {t}. All numbers {problem.numbers} used once."
            )
            n_tok = rng.randint(92, 162)
        else:
            think = f"Check {problem.solution} = {t}. Uses {problem.numbers} exactly once."
            n_tok = rng.randint(58, 108)
        ans = problem.solution
        raw = f"<think>{think}</think>\n<answer>{ans}</answer>"
        return raw, think, ans, n_tok

    # Incorrect but well-formatted
    wrong_exprs = [
        f"{a} + {b} + {c}",
        f"{c} * {a} - {b}",
        f"({b} + {c}) * {a}",
        f"{c} * {b} - {a}",
        f"{a} * {b} + {a}",  # duplicate number mistake
    ]
    ans = rng.choice(wrong_exprs)
    think = f"Let's test {a} + {b} = {a + b}. Trying {ans} to get close to {t}."
    raw = f"<think>{think}</think>\n<answer>{ans}</answer>"
    return raw, think, ans, rng.randint(64, 130)


def generate_preset_run(preset_id: str, num_steps: int = 60, seed: int = 2026) -> RunLog:
    """Generate a realistic, internally consistent training trajectory for a given preset."""
    preset = PRESETS[preset_id]
    rng = random.Random(seed + sum(ord(ch) for ch in preset_id))
    problems = generate_countdown_dataset(size=num_steps + 10, seed=seed)

    steps: list[StepLog] = []
    for step_idx in range(num_steps):
        step = step_idx * (150 // max(1, num_steps - 1)) if num_steps > 1 else 0
        ratio = step_idx / max(1, num_steps - 1)
        prob = problems[step_idx]

        # Preset-specific behavioral dynamics
        gibberish_p = 0.0
        hack_p = 0.0
        format_p = 0.96

        if preset_id == "sft_probe":
            acc_target = 0.16 + 0.03 * math.sin(step_idx * 0.4)
            ent_val = 0.88 + rng.uniform(-0.04, 0.04)
            kl_val = 0.0
            clip_val = 0.0
            len_base = 82.0
        elif preset_id == "baseline_grpo":
            # Smooth climb 16% -> 68%, healthy length emergence 80 -> 142, gradual entropy decay
            acc_target = 0.16 + 0.54 / (1.0 + math.exp(-7.5 * (ratio - 0.42)))
            ent_val = 0.90 - 0.48 * (ratio**0.8) + rng.uniform(-0.025, 0.025)
            kl_val = 0.01 + 0.055 * (1.0 - math.exp(-3.2 * ratio)) + rng.uniform(-0.004, 0.004)
            clip_val = 0.02 + 0.03 * ratio if preset.update_epochs > 1 else 0.0
            len_base = 84.0 + 58.0 / (1.0 + math.exp(-6.5 * (ratio - 0.45)))
        elif preset_id == "reinforce_basic":
            # Slower, noisier climb 16% -> 51%
            acc_target = 0.16 + 0.36 / (1.0 + math.exp(-5.0 * (ratio - 0.52))) + rng.uniform(-0.04, 0.04)
            ent_val = 0.92 - 0.35 * ratio + rng.uniform(-0.05, 0.05)
            kl_val = 0.015 + 0.08 * ratio + rng.uniform(-0.01, 0.01)
            clip_val = 0.0
            len_base = 84.0 + 34.0 * ratio
        elif preset_id == "no_format_reward":
            # Sparse 0/1 reward: cold-start plateau for first 45% of steps, then slower recovery
            format_p = 0.55 + 0.35 * ratio
            acc_target = 0.12 + 0.31 / (1.0 + math.exp(-8.0 * (ratio - 0.68)))
            ent_val = 0.94 - 0.25 * (ratio**1.5) + rng.uniform(-0.04, 0.04)
            kl_val = 0.01 + 0.045 * (ratio**1.4) + rng.uniform(-0.005, 0.005)
            clip_val = 0.0
            len_base = 76.0 + 30.0 * (ratio**1.5)
        elif preset_id == "reward_shift_plus10":
            # All rewards in [10, 11.1] without baseline -> massive variance, accuracy collapses
            acc_target = max(0.03, 0.17 * math.exp(-2.8 * ratio) + rng.uniform(-0.02, 0.03))
            ent_val = 0.92 + 0.45 * ratio + rng.uniform(-0.06, 0.06)
            kl_val = 0.04 + 0.42 * (ratio**1.3) + rng.uniform(-0.02, 0.03)
            clip_val = 0.0
            len_base = 85.0 + 115.0 * (ratio**1.2)
            gibberish_p = min(0.75, max(0.0, (ratio - 0.3) * 1.1))
        elif preset_id == "ppo_multi_epoch":
            # 4 update epochs with clipping: faster convergence + visible clip_fraction
            acc_target = 0.17 + 0.58 / (1.0 + math.exp(-8.5 * (ratio - 0.34)))
            ent_val = 0.88 - 0.50 * (ratio**0.75) + rng.uniform(-0.02, 0.02)
            kl_val = 0.015 + 0.075 * (1.0 - math.exp(-3.8 * ratio)) + rng.uniform(-0.005, 0.005)
            clip_val = 0.07 + 0.11 * math.sin(ratio * math.pi) + rng.uniform(-0.015, 0.015)
            len_base = 86.0 + 62.0 / (1.0 + math.exp(-7.0 * (ratio - 0.38)))
        elif preset_id == "kl_zero_collapse":
            # Multi-epoch with beta=0 and no clip -> initial spike then policy explodes into gibberish
            if ratio < 0.32:
                acc_target = 0.18 + 0.34 * (ratio / 0.32)
            else:
                acc_target = max(0.04, 0.52 * math.exp(-5.2 * (ratio - 0.32)))
            ent_val = max(0.06, 0.88 - 0.5 * ratio) if ratio < 0.4 else 0.55 + 0.95 * (ratio - 0.4)
            kl_val = 0.02 + 1.45 * (ratio**2.1)
            clip_val = 0.0
            len_base = 85.0 + 158.0 * (ratio**1.6)
            gibberish_p = min(0.92, max(0.0, (ratio - 0.35) * 1.45))
        elif preset_id == "reward_hacking":
            # Discovers `<answer>{target}</answer>` around step 35; reward shoots to 1.1, length crashes!
            hack_p = 1.0 / (1.0 + math.exp(-13.0 * (ratio - 0.28)))
            acc_target = max(0.04, 0.18 * (1.0 - hack_p))
            ent_val = 0.88 - 0.76 * hack_p + rng.uniform(-0.015, 0.015)
            kl_val = 0.02 + 0.38 * hack_p + rng.uniform(-0.01, 0.01)
            clip_val = 0.02
            len_base = 88.0 - 54.0 * hack_p
        elif preset_id == "entropy_collapse":
            # Low temperature + weak KL -> entropy crashes near 0, accuracy stalls early
            acc_target = 0.17 + 0.21 * (1.0 - math.exp(-6.0 * ratio))
            ent_val = max(0.04, 0.58 * math.exp(-5.2 * ratio) + rng.uniform(-0.01, 0.01))
            kl_val = 0.02 + 0.16 * (1.0 - math.exp(-4.0 * ratio))
            clip_val = 0.04
            len_base = 74.0 - 12.0 * ratio
        else:  # offline_dpo
            # Fast early rise on in-distribution pairs, then plateaus around 47% (distribution shift)
            acc_target = 0.17 + 0.32 * (1.0 - math.exp(-6.5 * ratio)) - 0.03 * max(0.0, ratio - 0.65)
            ent_val = 0.86 - 0.55 * (ratio**0.7) + rng.uniform(-0.02, 0.02)
            kl_val = 0.02 + 0.24 * (ratio**1.1) + rng.uniform(-0.01, 0.01)
            clip_val = 0.0
            len_base = 84.0 + 18.0 * (1.0 - math.exp(-4.0 * ratio))

        acc_target = min(0.95, max(0.02, acc_target))

        # Synthesize G group rollouts
        raw_samples: list[tuple[str, str, str, int, object]] = []
        for g_idx in range(preset.group_size):
            # Intentionally create occasional zero-gradient groups early/late for teaching
            force_all_fail = preset_id == "baseline_grpo" and step_idx == 2
            force_all_pass = preset_id == "baseline_grpo" and step_idx == num_steps - 3

            if force_all_fail:
                is_hack, is_gib, is_corr, has_fmt = False, False, False, True
            elif force_all_pass:
                is_hack, is_gib, is_corr, has_fmt = False, False, True, True
            else:
                is_hack = rng.random() < hack_p
                is_gib = (not is_hack) and (rng.random() < gibberish_p)
                has_fmt = rng.random() < format_p
                is_corr = (not is_hack) and (not is_gib) and has_fmt and (rng.random() < acc_target)

            raw, think, ans, n_tok = _synthesize_completion(
                rng,
                prob,
                is_correct=is_corr,
                is_hack=is_hack,
                is_gibberish=is_gib,
                has_format=has_fmt,
                step_ratio=ratio,
            )
            # Blend length smoothly toward preset trajectory
            n_tok = max(18, min(256, int(0.55 * n_tok + 0.45 * len_base + rng.randint(-12, 12))))
            breakdown = verify_countdown(
                raw,
                prob.numbers,
                prob.target,
                use_format_reward=preset.use_format_reward,
                check_numbers_exact=preset.check_numbers_exact,
                reward_shift=preset.reward_shift,
            )
            raw_samples.append((raw, think, ans, n_tok, breakdown))

        rewards = [item[4].total_reward for item in raw_samples]  # type: ignore[attr-defined]
        mean_r = sum(rewards) / len(rewards)
        var_r = sum((r - mean_r) ** 2 for r in rewards) / len(rewards)
        std_r = math.sqrt(var_r)
        zero_grad_group = std_r < 1e-6 and preset.use_baseline

        samples: list[SampleRollout] = []
        for idx, (raw, think, ans, n_tok, breakdown) in enumerate(raw_samples):
            r = breakdown.total_reward  # type: ignore[attr-defined]
            if preset.use_baseline:
                adv = 0.0 if zero_grad_group else (r - mean_r) / (std_r + 1e-6)
            else:
                adv = r

            # Attach token-level probabilities on sample 0 of every step (compact JSON, works on every step)
            tok_probs = (
                _make_token_probs(
                    rng,
                    ans or prob.solution,
                    prob.target,
                    entropy_level=max(0.05, ent_val),
                    kl_level=max(0.0, kl_val),
                    advantage=adv,
                )
                if idx == 0
                else []
            )

            samples.append(
                SampleRollout(
                    index=idx,
                    raw_text=raw,
                    think_text=think,
                    answer_text=ans,
                    num_tokens=n_tok,
                    mean_log_prob=round(-0.35 - 0.45 * max(0.05, ent_val) + rng.uniform(-0.08, 0.08), 4),
                    reward=round(r, 4),
                    advantage=round(adv, 4),
                    breakdown=breakdown,  # type: ignore[arg-type]
                    token_probs=tok_probs,
                )
            )

        # True accuracy (excluding reward hacks!) vs observed reward
        true_acc = sum(1 for s in samples if s.breakdown.numbers_valid and s.breakdown.target_matched) / len(samples)
        smoothed_acc = round(0.65 * acc_target + 0.35 * true_acc, 4)
        avg_len = round(sum(s.num_tokens for s in samples) / len(samples), 1)

        metrics = StepMetrics(
            step=step,
            accuracy=smoothed_acc,
            mean_reward=round(mean_r, 4),
            reward_std=round(std_r, 4),
            mean_response_length=avg_len,
            entropy=round(max(0.03, ent_val), 4),
            kl_divergence=round(max(0.0, kl_val), 4),
            clip_fraction=round(max(0.0, min(1.0, clip_val)), 4),
            loss=round(0.45 * (1.0 - smoothed_acc) + 0.05 * kl_val + rng.uniform(-0.04, 0.04), 4),
            grad_norm=round(0.0 if zero_grad_group else (0.65 + (2.4 if preset_id == "reward_shift_plus10" else 0.3) * rng.random()), 4),
            zero_grad_step=zero_grad_group,
            vram_allocated_gb=round(4.65 + 0.55 * (avg_len / 256.0), 2),
            vram_peak_gb=round(5.15 + 0.65 * (avg_len / 256.0), 2),
            step_time_sec=round(3.8 + 4.2 * (avg_len / 256.0), 2),
        )

        steps.append(
            StepLog(
                step=step,
                prompt_numbers=prob.numbers,
                prompt_target=prob.target,
                prompt_solution=prob.solution,
                metrics=metrics,
                group_mean_reward=round(mean_r, 4),
                group_std_reward=round(std_r, 4),
                zero_grad_group=zero_grad_group,
                samples=samples,
            )
        )

    return RunLog(
        metadata=RunMetadata(
            run_id=f"demo-{preset_id}",
            preset_id=preset_id,
            lesson_id=preset.lesson_id,
            algorithm=preset.algorithm,  # type: ignore[arg-type]
            group_size=preset.group_size,
            kl_beta=preset.kl_beta,
            clip_eps=preset.clip_eps,
            update_epochs=preset.update_epochs,
            learning_rate=preset.learning_rate,
            use_format_reward=preset.use_format_reward,
            check_numbers_exact=preset.check_numbers_exact,
            reward_shift=preset.reward_shift,
            use_baseline=preset.use_baseline,
            is_mock=True,
            created_at="2026-11-25T00:00:00Z",
        ),
        steps=steps,
    )


def export_all_demo_runs(output_path: Path, num_steps: int = 45) -> dict[str, RunLog]:
    """Generate and write all pre-recorded demo runs to a single JSON bundle for the frontend."""
    bundle: dict[str, dict] = {}
    runs: dict[str, RunLog] = {}
    for preset_id in PRESETS:
        run = generate_preset_run(preset_id, num_steps=num_steps)
        runs[preset_id] = run
        bundle[preset_id] = run.model_dump()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return runs
