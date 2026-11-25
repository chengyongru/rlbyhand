"""Tests for the 1-second Dry-Run user code validator."""

from __future__ import annotations

from llm_rl_lab.sandbox import dry_run_user_code


def test_dry_run_valid_grpo_loss():
    code = """
def grpo_loss(per_token_logp, ref_logp, mask, rewards, kl_beta=0.04):
    adv = (rewards - rewards.mean()) / (rewards.std(unbiased=False) + 1e-6)
    adv = adv.detach().unsqueeze(-1)
    log_r = (ref_logp - per_token_logp).clamp(-20.0, 20.0)
    kl = torch.exp(log_r) - log_r - 1.0
    seq_lens = mask.sum(dim=-1).clamp(min=1.0)
    loss = ((-per_token_logp * adv + kl_beta * kl) * mask).sum(dim=-1) / seq_lens
    return loss.mean()
"""
    res = dry_run_user_code("lesson-3", code)
    assert res.ok, res.summary
    assert all(c["passed"] for c in res.checks)


def test_dry_run_catches_detached_loss():
    code = """
def reinforce_loss(per_token_logp, mask, rewards):
    return (per_token_logp.detach() * mask).mean()
"""
    res = dry_run_user_code("lesson-2", code)
    assert not res.ok
    grad_check = [c for c in res.checks if c["name"] == "gradient_flow"][0]
    assert not grad_check["passed"]


def test_dry_run_blocks_forbidden_imports():
    code = "import os\ndef reinforce_loss(a, b, c): return a.mean()"
    res = dry_run_user_code("lesson-2", code)
    assert not res.ok
    assert res.error_line == 1


def test_dry_run_lesson5_reward_hack_probe():
    code = """
def compute_reward(completion, numbers, target):
    m = re.search(r"<answer>(.*?)</answer>", completion, re.DOTALL)
    if not m:
        return 0.0
    val = safe_eval_expr(m.group(1))
    return 1.0 if (val is not None and abs(val - target) < 1e-5) else 0.0
"""
    res = dry_run_user_code("lesson-5", code)
    assert res.ok
    assert "Reward Hacking active" in res.summary
