"""Tests for Countdown generator, AST-safe arithmetic evaluator, and RLVR verifier."""

from __future__ import annotations

import random

from llm_rl_lab.countdown import (
    build_countdown_prompt,
    generate_countdown_dataset,
    safe_eval_expr,
    verify_countdown,
)


def test_safe_eval_expr_basic_and_safety():
    assert safe_eval_expr("3 * 7 + 12") == 33.0
    assert safe_eval_expr("(12 - 3) * 7") == 63.0
    assert safe_eval_expr("10 / 0") is None
    assert safe_eval_expr("__import__('os').system('ls')") is None
    assert safe_eval_expr("9 ** 9 ** 9") is None


def test_dataset_is_solvable_and_deterministic():
    ds1 = generate_countdown_dataset(size=25, seed=7)
    ds2 = generate_countdown_dataset(size=25, seed=7)
    assert ds1 == ds2
    for prob in ds1:
        val = safe_eval_expr(prob.solution)
        assert val is not None
        assert abs(val - prob.target) < 1e-6


def test_verify_countdown_exact_vs_hack_mode():
    good = "<think>3*7=21, +12=33</think><answer>3 * 7 + 12</answer>"
    res_good = verify_countdown(good, [3, 7, 12], 33)
    assert res_good.format_reward == 0.1
    assert res_good.correct_reward == 1.0
    assert res_good.total_reward == 1.1
    assert res_good.numbers_valid and res_good.target_matched
    assert not res_good.hack_detected

    shortcut = "<think>Target is 33.</think><answer>33</answer>"
    res_strict = verify_countdown(shortcut, [3, 7, 12], 33, check_numbers_exact=True)
    assert res_strict.correct_reward == 0.0
    assert not res_strict.hack_detected

    res_hack = verify_countdown(shortcut, [3, 7, 12], 33, check_numbers_exact=False)
    assert res_hack.correct_reward == 1.0
    assert res_hack.hack_detected


def test_verify_countdown_no_format_and_reward_shift():
    good = "<think>ok</think><answer>3 * 7 + 12</answer>"
    res_sparse = verify_countdown(good, [3, 7, 12], 33, use_format_reward=False)
    assert res_sparse.format_reward == 0.0
    assert res_sparse.total_reward == 1.0

    res_shift = verify_countdown(good, [3, 7, 12], 33, reward_shift=10.0)
    assert res_shift.total_reward == 11.1


def test_prompt_builder_contains_tags():
    prompt = build_countdown_prompt([3, 7, 12], 33, include_one_shot=True)
    assert "<think>" in prompt and "<answer>" in prompt
    assert "[3, 7, 12]" in prompt and "33" in prompt
