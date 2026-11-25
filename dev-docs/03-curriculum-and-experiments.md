# 03 · Curriculum & Experiment Matrix

## Pedagogical Strategy

Rather than starting from Markov Decision Processes, Bellman equations, or 4-model PPO RLHF, the course starts directly from **RLVR (Reinforcement Learning with Verifiable Rewards)** and connects every mechanism to undergraduate math (calculus, linear algebra, probability & statistics) using one fixed model organism: **`Qwen2.5-0.5B-Instruct` + LoRA on 3-number Countdown**.

Following Stanford CS 312 (*Deep Learning Alchemy*), every lesson ends with a **Predict Before You Run** challenge that presents a concrete Code Diff, locks the reader's hypothesis, and overlays the ablation curve against the baseline.

## 6-Lesson Syllabus & Preset Mapping

| Lesson | Core Concept | Math Prerequisite | Default Preset | Ablation / Comparison | Surgical Function |
| --- | --- | --- | --- | --- | --- |
| `01` | LLM as conditional distribution & SFT | Chain rule, MLE | `sft_probe` | `baseline_grpo` vs `sft_probe` | `compute_sft_loss` |
| `02` | Log-derivative trick & REINFORCE | $(\ln f)' = f'/f$, MC expectation | `reinforce_basic` | `no_format_reward` (sparse 0/1) | `reinforce_loss` |
| `03` | Variance curse, Baseline & GRPO | Mean/variance, Z-score | `baseline_grpo` | `reward_shift_plus10` (all +10, no baseline) | `grpo_loss` |
| `04` | Multi-epoch IS, PPO Clip & k3 KL | Importance sampling, $e^x - x - 1 \ge 0$ | `ppo_multi_epoch` | `kl_zero_collapse` ($\beta=0$, unclipped) | `ppo_grpo_loss` |
| `05` | Failure diagnostics: Hacking & Entropy | Shannon entropy, Goodhart's law | `reward_hacking` | `reward_hacking` & `entropy_collapse` | `compute_reward` |
| `06` | Offline DPO vs Online GRPO | Bradley-Terry, Sigmoid | `offline_dpo` | `offline_dpo` vs `baseline_grpo` | `dpo_loss` |

## Countdown Model Organism Specification

- **Default difficulty**: 3 integers in `[1, 15]`, operators `{+, -, *}` (division disabled initially to avoid floating-point / integer-division ambiguity), target in `[5, 80]`, guaranteed solvable by construction.
- **Prompt format**: Short instruction with 1 fixed 1-shot example demonstrating `<think>...</think>` and `<answer>...</answer>` tags. Including 1-shot avoids burning the first 50 steps merely teaching a 0.5B model to emit XML tags.
- **Reward function (`countdown.py:verify_countdown`)**:
  - Format reward `+0.1`: valid non-empty `<think>` and `<answer>` tags with legal arithmetic characters.
  - Correctness reward `+1.0`: AST-safe evaluation matches `target` within `1e-5` AND sorted extracted integers exactly match the prompt's numbers.
  - Reward Hacking toggle (`check_numbers_exact=False`): intentionally drops the sorted-number check so `<answer>{target}</answer>` scores `1.1`, reliably demonstrating Goodhart's law inside 40–60 steps.
- **Calibration target**: Initial `Pass@1` should sit in **10%–30%** and `Pass@6` should exceed **45%**. If your home GPU run shows `Pass@1 < 8%`, narrow `max_num` to `12`; if `Pass@1 > 40%`, raise `max_num` to `20` or enable `/`.
