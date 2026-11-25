"""8GB-VRAM PyTorch RL Trainer + CPU MockTrainer for live WebSocket streaming.

Key 8GB VRAM engineering choices implemented here:
1. Single Qwen2.5-0.5B-Instruct model + LoRA (r=16): reference log-probs computed via
   `model.disable_adapter()` with 0 GB extra VRAM.
2. Left-padded batched rollout with `StoppingCriteria` on `</answer>` for 2-3x faster sampling.
3. Chunked log_prob/entropy extraction + micro-batch gradient accumulation (1-2 sequences per
   backward pass) to prevent Qwen2.5's 151,936-vocab float32 logits from spiking VRAM.
"""

from __future__ import annotations

import asyncio
import json
import math
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable

from .config import PRESETS, detect_device_telemetry
from .countdown import (
    ANSWER_RE,
    THINK_RE,
    build_countdown_prompt,
    generate_countdown_dataset,
    verify_countdown,
)
from .demo_data import generate_preset_run
from .schema import (
    RunLog,
    RunMetadata,
    SampleRollout,
    StartTrainRequest,
    StepLog,
    StepMetrics,
)

EventCallback = Callable[[dict[str, Any]], Awaitable[None]]


class TrainingCancelledError(Exception):
    """Raised when the user stops an active training run."""


def _make_answer_stopping_criteria(tokenizer: Any) -> Any:
    """Stop generation early once every sequence in the batch has emitted `</answer>`."""
    from transformers import StoppingCriteria

    stop_str = "</answer>"

    class AnswerTagStopper(StoppingCriteria):
        def __call__(self, input_ids: Any, scores: Any, **kwargs: Any) -> bool:
            tail = input_ids[:, -10:]
            texts = tokenizer.batch_decode(tail, skip_special_tokens=False)
            return all(stop_str in t for t in texts)

    return AnswerTagStopper()


class MockTrainer:
    """Streams deterministic realistic steps over WebSocket so UI/local-mode can be tested without a GPU."""

    async def run(
        self,
        req: StartTrainRequest,
        emit: EventCallback,
        cancel_event: asyncio.Event,
        runs_dir: Path,
    ) -> RunLog:
        preset = PRESETS.get(req.preset_id, PRESETS["baseline_grpo"])
        total_steps = req.total_steps or (
            preset.total_steps_fast if req.speed_mode == "fast" else preset.total_steps_full
        )
        run = generate_preset_run(preset.preset_id, num_steps=min(total_steps, 45))
        run.metadata.run_id = f"mock-{uuid.uuid4().hex[:8]}"
        run.metadata.created_at = datetime.now(timezone.utc).isoformat()

        await emit({"type": "run_started", "metadata": run.metadata.model_dump()})
        await emit(
            {
                "type": "log",
                "level": "info",
                "message": f"[Mock Mode] Streaming preset `{preset.preset_id}` ({len(run.steps)} steps).",
            }
        )

        emitted_steps: list[StepLog] = []
        for step_log in run.steps:
            if cancel_event.is_set():
                await emit({"type": "log", "level": "warn", "message": "Training stopped by user."})
                break
            await asyncio.sleep(0.28)
            emitted_steps.append(step_log)
            await emit({"type": "step", "step": step_log.model_dump()})

        run.steps = emitted_steps
        runs_dir.mkdir(parents=True, exist_ok=True)
        out_file = runs_dir / f"{run.metadata.run_id}.json"
        out_file.write_text(run.model_dump_json(indent=2), encoding="utf-8")

        await emit({"type": "run_finished", "run_id": run.metadata.run_id, "steps": len(emitted_steps)})
        return run


class RealGPUTrainer:
    """Real 8GB-VRAM PyTorch trainer using Qwen2.5-0.5B-Instruct + LoRA + disable_adapter() KL."""

    def __init__(self, model_name: str = "Qwen/Qwen2.5-0.5B-Instruct") -> None:
        self.model_name = model_name
        self._model: Any = None
        self._tokenizer: Any = None

    def _ensure_model(self) -> tuple[Any, Any, str, Any]:
        import torch
        from peft import LoraConfig, get_peft_model
        from transformers import AutoModelForCausalLM, AutoTokenizer

        telemetry = detect_device_telemetry(mock_mode=False)
        device = telemetry.device_type
        dtype_map = {
            "bfloat16": torch.bfloat16,
            "float16": torch.float16,
            "float32": torch.float32,
        }
        torch_dtype = dtype_map[telemetry.recommended_dtype]

        if self._tokenizer is None:
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._tokenizer.padding_side = "left"
            if self._tokenizer.pad_token is None:
                self._tokenizer.pad_token = self._tokenizer.eos_token

        if self._model is None:
            base = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype=torch_dtype,
            ).to(device)
            base.gradient_checkpointing_enable()
            base.config.use_cache = False

            lora_cfg = LoraConfig(
                r=16,
                lora_alpha=32,
                lora_dropout=0.0,
                bias="none",
                task_type="CAUSAL_LM",
                target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            )
            self._model = get_peft_model(base, lora_cfg)

        return self._model, self._tokenizer, device, torch_dtype

    async def run(
        self,
        req: StartTrainRequest,
        emit: EventCallback,
        cancel_event: asyncio.Event,
        runs_dir: Path,
    ) -> RunLog:
        import torch
        from transformers import StoppingCriteriaList

        from .algorithms import (
            compute_grpo_advantages,
            compute_kl_k3,
            compute_per_token_logprobs_and_entropy,
        )

        preset = PRESETS.get(req.preset_id, PRESETS["baseline_grpo"])
        total_steps = req.total_steps or (
            preset.total_steps_fast if req.speed_mode == "fast" else preset.total_steps_full
        )
        group_size = req.group_size or preset.group_size
        kl_beta = preset.kl_beta if req.kl_beta is None else req.kl_beta
        update_epochs = req.update_epochs or preset.update_epochs
        use_format = preset.use_format_reward if req.use_format_reward is None else req.use_format_reward
        check_nums = preset.check_numbers_exact if req.check_numbers_exact is None else req.check_numbers_exact
        reward_shift = preset.reward_shift if req.reward_shift is None else req.reward_shift

        await emit({"type": "log", "level": "info", "message": f"Loading {self.model_name} with LoRA (r=16)..."})
        model, tokenizer, device, torch_dtype = await asyncio.to_thread(self._ensure_model)

        optimizer = torch.optim.AdamW(
            [p for p in model.parameters() if p.requires_grad],
            lr=preset.learning_rate,
        )
        dataset = generate_countdown_dataset(size=total_steps + 16, seed=42)
        stopper = StoppingCriteriaList([_make_answer_stopping_criteria(tokenizer)])

        run_id = f"gpu-{uuid.uuid4().hex[:8]}"
        meta = RunMetadata(
            run_id=run_id,
            preset_id=preset.preset_id,
            lesson_id=req.lesson_id,
            algorithm=preset.algorithm,  # type: ignore[arg-type]
            model_name=self.model_name,
            dtype=str(torch_dtype).replace("torch.", ""),
            group_size=group_size,
            kl_beta=kl_beta,
            clip_eps=preset.clip_eps,
            update_epochs=update_epochs,
            learning_rate=preset.learning_rate,
            use_format_reward=use_format,
            check_numbers_exact=check_nums,
            reward_shift=reward_shift,
            use_baseline=preset.use_baseline,
            is_mock=False,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        await emit({"type": "run_started", "metadata": meta.model_dump()})
        await emit({"type": "log", "level": "info", "message": f"Model ready on {device} ({meta.dtype}). Starting {total_steps} steps."})

        steps: list[StepLog] = []
        micro_batch_size = 2  # Keep Qwen2.5 151k-vocab logits safely inside 8GB VRAM

        for step_idx in range(total_steps):
            if cancel_event.is_set():
                await emit({"type": "log", "level": "warn", "message": "Training stopped by user."})
                break

            t_start = time.perf_counter()
            problem = dataset[step_idx]
            prompt_text = build_countdown_prompt(problem.numbers, problem.target, include_one_shot=True)
            prompt_inputs = tokenizer([prompt_text] * group_size, return_tensors="pt", padding=True).to(device)
            prompt_len = prompt_inputs["input_ids"].shape[1]

            # 1. Batched rollout with KV cache enabled
            model.eval()
            model.config.use_cache = True
            with torch.no_grad():
                full_ids = model.generate(
                    **prompt_inputs,
                    max_new_tokens=256,
                    do_sample=True,
                    temperature=preset.temperature,
                    top_p=0.95,
                    pad_token_id=tokenizer.pad_token_id,
                    stopping_criteria=stopper,
                )
            model.config.use_cache = False

            resp_ids = full_ids[:, prompt_len:]
            resp_mask = (resp_ids != tokenizer.pad_token_id).long()
            completions = tokenizer.batch_decode(resp_ids, skip_special_tokens=True)

            # 2. Rule-based RLVR verification
            breakdowns = [
                verify_countdown(
                    c,
                    problem.numbers,
                    problem.target,
                    use_format_reward=use_format,
                    check_numbers_exact=check_nums,
                    reward_shift=reward_shift,
                )
                for c in completions
            ]
            rewards_t = torch.tensor([b.total_reward for b in breakdowns], dtype=torch.float32, device=device)
            mean_r = float(rewards_t.mean().item())
            std_r = float(rewards_t.std(unbiased=False).item())

            if preset.use_baseline:
                adv_t, zero_grad_group = compute_grpo_advantages(rewards_t)
            else:
                adv_t, zero_grad_group = rewards_t.clone(), False

            # 3. Compute old_logp & ref_logp (via disable_adapter(), 0 GB extra VRAM!)
            attn_mask = (full_ids != tokenizer.pad_token_id).long()
            target_ids = full_ids[:, 1:]

            with torch.no_grad():
                old_logp_list, ent_list, ref_logp_list = [], [], []
                for start in range(0, group_size, micro_batch_size):
                    end = min(start + micro_batch_size, group_size)
                    mb_ids = full_ids[start:end]
                    mb_attn = attn_mask[start:end]
                    mb_tgt = target_ids[start:end]

                    out_old = model(input_ids=mb_ids, attention_mask=mb_attn)
                    lp_old, ent_mb = compute_per_token_logprobs_and_entropy(out_old.logits[:, :-1, :], mb_tgt)
                    old_logp_list.append(lp_old[:, prompt_len - 1 :])
                    ent_list.append(ent_mb[:, prompt_len - 1 :])
                    del out_old

                    with model.disable_adapter():
                        out_ref = model(input_ids=mb_ids, attention_mask=mb_attn)
                        lp_ref, _ = compute_per_token_logprobs_and_entropy(out_ref.logits[:, :-1, :], mb_tgt)
                        ref_logp_list.append(lp_ref[:, prompt_len - 1 :])
                        del out_ref

                old_logp_all = torch.cat(old_logp_list, dim=0)
                ent_all = torch.cat(ent_list, dim=0)
                ref_logp_all = torch.cat(ref_logp_list, dim=0)

            # 4. Micro-batched policy update (stays under ~5.5 GB peak VRAM)
            total_loss_val = 0.0
            kl_val = 0.0
            clip_frac_val = 0.0
            grad_norm_val = 0.0

            if not zero_grad_group and preset.algorithm != "sft_probe":
                model.train()
                for _epoch in range(update_epochs):
                    optimizer.zero_grad(set_to_none=True)
                    epoch_kl = 0.0
                    epoch_clip = 0.0
                    num_mb = math.ceil(group_size / micro_batch_size)

                    for start in range(0, group_size, micro_batch_size):
                        end = min(start + micro_batch_size, group_size)
                        mb_ids = full_ids[start:end]
                        mb_attn = attn_mask[start:end]
                        mb_tgt = target_ids[start:end]
                        mb_mask = resp_mask[start:end].float()
                        mb_adv = adv_t[start:end].detach().unsqueeze(-1)
                        mb_old = old_logp_all[start:end].detach()
                        mb_ref = ref_logp_all[start:end].detach()

                        out = model(input_ids=mb_ids, attention_mask=mb_attn)
                        mb_logp_full, _ = compute_per_token_logprobs_and_entropy(out.logits[:, :-1, :], mb_tgt)
                        mb_logp = mb_logp_full[:, prompt_len - 1 :]

                        log_ratio = (mb_logp - mb_old).clamp(-20.0, 20.0)
                        ratio = torch.exp(log_ratio)
                        clipped = torch.clamp(ratio, 1.0 - preset.clip_eps, 1.0 + preset.clip_eps)
                        pg_tok = -torch.minimum(ratio * mb_adv, clipped * mb_adv)
                        kl_tok = compute_kl_k3(mb_logp, mb_ref)

                        seq_lens = mb_mask.sum(dim=-1).clamp(min=1.0)
                        mb_loss = (((pg_tok + kl_beta * kl_tok) * mb_mask).sum(dim=-1) / seq_lens).mean()
                        (mb_loss / num_mb).backward()

                        total_loss_val += float(mb_loss.detach().item()) / (num_mb * update_epochs)
                        epoch_kl += float(((kl_tok * mb_mask).sum() / mb_mask.sum().clamp(min=1.0)).detach().item()) / num_mb
                        clipped_m = ((ratio - 1.0).abs() > preset.clip_eps).float() * mb_mask
                        epoch_clip += float((clipped_m.sum() / mb_mask.sum().clamp(min=1.0)).detach().item()) / num_mb
                        del out

                    grad_norm_val = float(torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0).item())
                    optimizer.step()
                    kl_val = epoch_kl
                    clip_frac_val = epoch_clip

            # 5. Collect telemetry & rollout samples
            mask_f = resp_mask.float()
            avg_ent = float(((ent_all * mask_f).sum() / mask_f.sum().clamp(min=1.0)).item())
            true_acc = sum(1 for b in breakdowns if b.numbers_valid and b.target_matched) / group_size
            avg_len = float(mask_f.sum(dim=-1).mean().item())

            vram_alloc = round(torch.cuda.memory_allocated() / (1024**3), 2) if device == "cuda" else 0.0
            vram_peak = round(torch.cuda.max_memory_allocated() / (1024**3), 2) if device == "cuda" else 0.0

            samples: list[SampleRollout] = []
            for idx, (comp, b) in enumerate(zip(completions, breakdowns)):
                t_m = THINK_RE.search(comp)
                a_m = ANSWER_RE.search(comp)
                n_tok = int(mask_f[idx].sum().item())
                mean_lp = float(((old_logp_all[idx] * mask_f[idx]).sum() / max(1, n_tok)).item())
                samples.append(
                    SampleRollout(
                        index=idx,
                        raw_text=comp,
                        think_text=t_m.group(1).strip() if t_m else "",
                        answer_text=a_m.group(1).strip() if a_m else "",
                        num_tokens=n_tok,
                        mean_log_prob=round(mean_lp, 4),
                        reward=round(b.total_reward, 4),
                        advantage=round(float(adv_t[idx].item()), 4),
                        breakdown=b,
                    )
                )

            step_log = StepLog(
                step=step_idx,
                prompt_numbers=problem.numbers,
                prompt_target=problem.target,
                prompt_solution=problem.solution,
                metrics=StepMetrics(
                    step=step_idx,
                    accuracy=round(true_acc, 4),
                    mean_reward=round(mean_r, 4),
                    reward_std=round(std_r, 4),
                    mean_response_length=round(avg_len, 1),
                    entropy=round(avg_ent, 4),
                    kl_divergence=round(kl_val, 4),
                    clip_fraction=round(clip_frac_val, 4),
                    loss=round(total_loss_val, 4),
                    grad_norm=round(grad_norm_val, 4),
                    zero_grad_step=zero_grad_group,
                    vram_allocated_gb=vram_alloc,
                    vram_peak_gb=vram_peak,
                    step_time_sec=round(time.perf_counter() - t_start, 2),
                ),
                group_mean_reward=round(mean_r, 4),
                group_std_reward=round(std_r, 4),
                zero_grad_group=zero_grad_group,
                samples=samples,
            )
            steps.append(step_log)
            await emit({"type": "step", "step": step_log.model_dump()})
            await asyncio.sleep(0)

        run_log = RunLog(metadata=meta, steps=steps)
        runs_dir.mkdir(parents=True, exist_ok=True)
        (runs_dir / f"{run_id}.json").write_text(run_log.model_dump_json(indent=2), encoding="utf-8")
        await emit({"type": "run_finished", "run_id": run_id, "steps": len(steps)})
        return run_log
