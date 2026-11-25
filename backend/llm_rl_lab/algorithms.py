"""Pure PyTorch LLM RL algorithms engineered for 8GB VRAM.

Includes:
- Memory-safe chunked per-token log_prob and entropy extraction
- REINFORCE (with optional mean baseline)
- GRPO with group Z-score normalization, zero-gradient detection, PPO clipping, and Schulman k3 KL
- Offline DPO (Bradley-Terry preference loss)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def _require_torch() -> Any:
    import torch

    return torch


@dataclass
class LossOutput:
    loss: Any
    kl_mean: float
    clip_fraction: float
    entropy_mean: float
    zero_grad_group: bool = False


def compute_per_token_logprobs_and_entropy(
    logits: Any,
    target_ids: Any,
    chunk_size: int = 64,
) -> tuple[Any, Any]:
    """Compute per-token log-probabilities and entropy in chunks to avoid huge float32 logits spikes.

    For Qwen2.5 (vocab=151,936), converting the entire (B, L, V) tensor to float32 at once can
    exceed 1.2 GB. Chunking along the sequence dimension keeps peak VRAM low on 8GB GPUs.
    """
    torch = _require_torch()
    import torch.nn.functional as F

    _, seq_len, _ = logits.shape
    logp_chunks = []
    ent_chunks = []

    for start in range(0, seq_len, chunk_size):
        end = min(start + chunk_size, seq_len)
        chunk_logits = logits[:, start:end, :].float()
        log_probs = F.log_softmax(chunk_logits, dim=-1)
        probs = log_probs.exp()

        chunk_targets = target_ids[:, start:end].unsqueeze(-1)
        token_logp = log_probs.gather(-1, chunk_targets).squeeze(-1)
        token_ent = -(probs * log_probs).sum(dim=-1)

        logp_chunks.append(token_logp)
        ent_chunks.append(token_ent)

    return torch.cat(logp_chunks, dim=1), torch.cat(ent_chunks, dim=1)


def compute_kl_k3(logp_theta: Any, logp_ref: Any) -> Any:
    """Schulman k3 unbiased, strictly non-negative KL estimator: r - log(r) - 1, r = pi_ref / pi_theta."""
    torch = _require_torch()
    log_ratio = (logp_ref - logp_theta).clamp(-20.0, 20.0)
    return torch.exp(log_ratio) - log_ratio - 1.0


def compute_grpo_advantages(
    rewards: Any,
    normalize_std: bool = True,
    eps: float = 1e-6,
) -> tuple[Any, bool]:
    """Compute group-relative advantages for a single prompt group of size G.

    Returns (advantages, is_zero_grad_group). When all samples in the group earn identical
    reward (e.g. all 0 or all 1.1), std ~= 0 and the step contributes zero policy gradient.
    """
    torch = _require_torch()
    mean_r = rewards.mean()
    std_r = rewards.std(unbiased=False)
    zero_grad = bool(std_r.item() < eps)
    if zero_grad:
        return torch.zeros_like(rewards), True
    if normalize_std:
        return (rewards - mean_r) / (std_r + eps), False
    return rewards - mean_r, False


def reinforce_loss(
    per_token_logp: Any,
    mask: Any,
    rewards: Any,
    *,
    use_baseline: bool = False,
    per_token_ref_logp: Any | None = None,
    kl_beta: float = 0.0,
) -> LossOutput:
    """Minimal REINFORCE policy gradient loss on response tokens."""
    weights = rewards - rewards.mean() if use_baseline else rewards
    mask_f = mask.float()
    seq_lens = mask_f.sum(dim=-1).clamp(min=1.0)
    seq_logp = (per_token_logp * mask_f).sum(dim=-1) / seq_lens
    pg_loss = -(weights.detach() * seq_logp).mean()

    kl_mean = 0.0
    if per_token_ref_logp is not None and kl_beta > 0.0:
        kl_per_tok = compute_kl_k3(per_token_logp, per_token_ref_logp.detach())
        kl_term = (kl_per_tok * mask_f).sum() / mask_f.sum().clamp(min=1.0)
        pg_loss = pg_loss + kl_beta * kl_term
        kl_mean = float(kl_term.detach().item())

    return LossOutput(
        loss=pg_loss,
        kl_mean=kl_mean,
        clip_fraction=0.0,
        entropy_mean=0.0,
        zero_grad_group=bool(use_baseline and rewards.std(unbiased=False).item() < 1e-6),
    )


def grpo_loss(
    per_token_logp: Any,
    per_token_old_logp: Any,
    per_token_ref_logp: Any,
    mask: Any,
    rewards: Any,
    *,
    clip_eps: float = 0.2,
    kl_beta: float = 0.04,
    normalize_std: bool = True,
    dr_grpo_length_norm: bool = False,
) -> LossOutput:
    """GRPO / PPO-clipped policy loss with Schulman k3 KL penalty."""
    torch = _require_torch()
    advantages, zero_grad = compute_grpo_advantages(rewards, normalize_std=normalize_std)
    adv = advantages.detach().unsqueeze(-1)
    mask_f = mask.float()

    log_ratio = (per_token_logp - per_token_old_logp.detach()).clamp(-20.0, 20.0)
    ratio = torch.exp(log_ratio)
    clipped_ratio = torch.clamp(ratio, 1.0 - clip_eps, 1.0 + clip_eps)

    unclipped = ratio * adv
    clipped = clipped_ratio * adv
    pg_per_tok = -torch.minimum(unclipped, clipped)

    kl_per_tok = compute_kl_k3(per_token_logp, per_token_ref_logp.detach())
    total_per_tok = pg_per_tok + kl_beta * kl_per_tok

    if dr_grpo_length_norm:
        loss = (total_per_tok * mask_f).sum() / mask_f.sum().clamp(min=1.0)
    else:
        seq_lens = mask_f.sum(dim=-1).clamp(min=1.0)
        loss = ((total_per_tok * mask_f).sum(dim=-1) / seq_lens).mean()

    clipped_mask = ((ratio - 1.0).abs() > clip_eps).float() * mask_f
    clip_frac = float((clipped_mask.sum() / mask_f.sum().clamp(min=1.0)).detach().item())
    kl_mean = float(((kl_per_tok * mask_f).sum() / mask_f.sum().clamp(min=1.0)).detach().item())

    return LossOutput(
        loss=loss,
        kl_mean=kl_mean,
        clip_fraction=clip_frac,
        entropy_mean=0.0,
        zero_grad_group=zero_grad,
    )


def dpo_loss(
    policy_chosen_logp: Any,
    policy_rejected_logp: Any,
    ref_chosen_logp: Any,
    ref_rejected_logp: Any,
    beta: float = 0.1,
) -> tuple[Any, float, float]:
    """Offline Direct Preference Optimization (Bradley-Terry) loss."""
    import torch.nn.functional as F

    chosen_rewards = beta * (policy_chosen_logp - ref_chosen_logp.detach())
    rejected_rewards = beta * (policy_rejected_logp - ref_rejected_logp.detach())
    logits = chosen_rewards - rejected_rewards
    loss = -F.logsigmoid(logits).mean()
    margin = float(logits.detach().mean().item())
    pair_acc = float((logits.detach() > 0).float().mean().item())
    return loss, margin, pair_acc
