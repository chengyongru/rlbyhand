# 04 · 8 GB VRAM Engineering Notes

Running online LLM RL on an 8 GB consumer GPU (e.g., RTX 3060/4060 Laptop or RTX 3070) requires tight control over peak memory—especially on Windows where the desktop compositor and Chrome browser consume 1.0–1.5 GB of VRAM alongside PyTorch.

## Memory Budget Breakdown

| Component | Est. VRAM | Technique |
| --- | --- | --- |
| `Qwen2.5-0.5B-Instruct` base (`bf16`/`fp16`) | ~1.0 GB | Single frozen base model; no `bitsandbytes` needed |
| LoRA adapters (`r=16`, `alpha=32`) + AdamW states | < 0.1 GB | Only adapter matrices have gradients & moments |
| Reference Model (for KL penalty) | **0.0 GB** | `with model.disable_adapter():` reuses frozen base weights |
| Critic & Reward Model | **0.0 GB** | Replaced by GRPO group Z-score + Python AST rule verifier |
| Activations + Chunked Logits | ~2.4–3.2 GB | Gradient checkpointing + `max_new_tokens=256` + `micro_batch_size=2` + 64-token logits chunking |
| PyTorch CUDA context + browser headroom | ~1.2–1.5 GB | Target safe total peak **<= 5.8 GB** |

## Critical Pitfalls Addressed in Backend Code

### 1. The 151,936-Vocab `logits` Spike (`algorithms.py`)

`Qwen2.5` has a vocabulary size of `151,936`. Computing `F.log_softmax(logits.float(), dim=-1)` on an entire group of `G=6`, `L=256` sequences allocates `6 × 256 × 151,936 × 4 bytes ≈ 0.93 GB` just for the float32 cast, and over `2 GB` with autograd buffers. `compute_per_token_logprobs_and_entropy()` chunks along the sequence dimension (`chunk_size=64`) and `RealGPUTrainer` accumulates gradients across `micro_batch_size=2` sequences so peak activation memory stays flat.

### 2. Zero-VRAM Reference Model (`trainer.py`)

In `RealGPUTrainer`, `old_logp` is computed with LoRA active under `torch.no_grad()`, and `ref_logp` is immediately computed on the same micro-batch inside `with model.disable_adapter():`. This avoids holding a second copy of the 0.5B model in VRAM.

### 3. Rollout Latency Optimization (`trainer.py`)

Rollout generation dominates wall-clock time on consumer GPUs. Three measures keep step times short:

- `tokenizer.padding_side = "left"` for batched parallel generation across all `G` rollouts of a prompt.
- `model.config.use_cache = True` during `model.generate()`, switched back to `False` before gradient-checkpointed backward passes.
- Custom `StoppingCriteria` (`AnswerTagStopper`) terminates `generate()` as soon as all sequences in the group emit `</answer>`, cutting average rollout latency by 2–3×.

### 4. Dtype Auto-Detection (`config.py`)

Not all 8 GB GPUs support native `bfloat16` (e.g., Turing RTX 2060/2070, GTX 1660, older MPS). `detect_device_telemetry()` inspects `torch.cuda.get_device_capability()`: compute capability `>= 8.0` (Ampere+) uses `bfloat16`; earlier CUDA cards and Apple Silicon MPS use `float16`.

### 5. Schulman k3 KL Estimator (`algorithms.py`)

Naive per-token `logp_theta - logp_ref` can take negative values on individual tokens and adds variance. We use Schulman's unbiased, strictly non-negative k3 estimator `exp(logp_ref - logp_theta) - (logp_ref - logp_theta) - 1` clamped to `[-20, 20]` before exponentiation to prevent overflow.
