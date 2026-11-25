"""Recording-only DPO. The trainer owns generation and logs the shared evaluation prompts.

Call make_dpo_update once, after trainer._ensure_model(). Pass its callback the zero-based
recording step and trainer optimizer, even if the evaluation group has uniform rewards.
Its only training data is the supplied real sft_probe RunLog, never the evaluation rollout.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from .algorithms import dpo_loss
from .countdown import render_countdown_prompt
from .schema import RunLog


@dataclass(frozen=True)
class PreferencePair:
    numbers: tuple[int, ...]
    target: int
    chosen: str
    rejected: str


def select_preference_pairs(probe_log: RunLog, *, min_pairs: int = 1) -> tuple[PreferencePair, ...]:
    """Take the first nonblank correct and incorrect raw texts per distinct prompt in log order."""
    meta = probe_log.metadata
    if meta.is_mock or meta.algorithm != "sft_probe" or meta.preset_id != "sft_probe":
        raise ValueError("offline DPO requires a real (non-mock) sft_probe RunLog")
    if min_pairs < 1:
        raise ValueError("min_pairs must be at least 1")

    by_prompt: dict[tuple[tuple[int, ...], int], dict[bool, str]] = {}
    for step in probe_log.steps:
        texts = by_prompt.setdefault((tuple(step.prompt_numbers), step.prompt_target), {})
        for sample in step.samples:
            if sample.raw_text.strip():
                b = sample.breakdown
                texts.setdefault(b.numbers_valid and b.target_matched, sample.raw_text)

    pairs = tuple(
        PreferencePair(numbers, target, texts[True], texts[False])
        for (numbers, target), texts in by_prompt.items()
        if len(texts) == 2 and texts[True] != texts[False]
    )
    if len(pairs) < min_pairs:
        raise ValueError(
            f"offline DPO needs at least {min_pairs} same-prompt correct/incorrect preference "
            f"pair(s); found {len(pairs)} in sft_probe run {meta.run_id!r}. "
            "Record more probe samples; evaluation rollouts cannot supply training pairs."
        )
    return pairs


def _response_logp(model: Any, ids: Any, prompt_len: int) -> Any:
    """Summed causal log probability, without prompt tokens, padding or length normalization."""
    import torch.nn.functional as F

    logits = model(input_ids=ids, use_cache=False).logits[0, prompt_len - 1 : -1]
    targets = ids[0, prompt_len:]
    # Only upcast small slices of Qwen's 151k-vocabulary logits at a time.
    return -sum(
        F.cross_entropy(chunk.float(), tokens, reduction="sum")
        for chunk, tokens in zip(logits.split(64), targets.split(64))
    )


def make_dpo_update(
    probe_log: RunLog,
    model: Any,
    tokenizer: Any,
    device: Any,
    beta: float,
    *,
    min_pairs: int = 1,
) -> Callable[[int, Any], tuple[float, float]]:
    """Freeze pairs and reference scores; return update(step_idx, optimizer) -> (loss, grad_norm).

    Apply one optimizer step per call, cycling through distinct probe problems. Reference
    scores use the frozen adapter-disabled base model. RunLog stores decoded text, not token
    IDs: re-tokenize each raw completion verbatim, without injecting BOS/EOS or padding.
    The returned norm is the total gradient norm before clipping to 1.0.
    """
    pairs = select_preference_pairs(probe_log, min_pairs=min_pairs)
    if not math.isfinite(beta) or beta <= 0:
        raise ValueError("offline DPO beta must be positive and finite")

    import torch

    scored_pairs = []
    was_training = model.training
    model.eval()
    try:
        with torch.no_grad(), model.disable_adapter():
            for pair in pairs:
                rendered = render_countdown_prompt(tokenizer, list(pair.numbers), pair.target)
                prompt = tokenizer.encode(rendered)  # Match the trainer's prompt tokenizer defaults.
                chosen = tokenizer.encode(pair.chosen, add_special_tokens=False)
                rejected = tokenizer.encode(pair.rejected, add_special_tokens=False)
                if not prompt or not chosen or not rejected or chosen == rejected:
                    raise ValueError("offline DPO pair needs a prompt and distinct nonempty tokenized responses")
                chosen_ids = torch.tensor([prompt + chosen], device=device)
                rejected_ids = torch.tensor([prompt + rejected], device=device)
                n = len(prompt)
                scored_pairs.append((
                    n, chosen_ids, rejected_ids,
                    _response_logp(model, chosen_ids, n), _response_logp(model, rejected_ids, n),
                ))
    finally:
        model.train(was_training)

    def update(step_idx: int, optimizer: Any) -> tuple[float, float]:
        if step_idx < 0:
            raise ValueError("step_idx must be zero-based and nonnegative")
        n, chosen_ids, rejected_ids, ref_chosen, ref_rejected = scored_pairs[step_idx % len(scored_pairs)]
        model.train()
        optimizer.zero_grad(set_to_none=True)
        loss, _, _ = dpo_loss(
            _response_logp(model, chosen_ids, n), _response_logp(model, rejected_ids, n),
            ref_chosen, ref_rejected, beta=beta,
        )
        loss.backward()
        norm = torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0, error_if_nonfinite=True)
        optimizer.step()
        return loss.item(), norm.item()

    return update
