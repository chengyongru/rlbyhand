"""Shared data schema for training runs, step metrics, rollouts, and WebSocket events.

Both real GPU training runs (trainer.py) and pre-recorded static replay logs (demo_data.py)
serialize to this exact schema so the frontend uses one unified rendering pipeline.
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class TokenCandidate(BaseModel):
    token: str
    prob: float


class TokenProbInfo(BaseModel):
    token: str
    prob: float
    log_prob: float
    entropy: float
    kl: float = 0.0
    advantage: float = 0.0
    top_candidates: list[TokenCandidate] = Field(default_factory=list)


class RewardBreakdown(BaseModel):
    format_reward: float = 0.0
    correct_reward: float = 0.0
    total_reward: float = 0.0
    has_think_tags: bool = False
    has_answer_tags: bool = False
    extracted_expr: str | None = None
    evaluated_value: float | None = None
    numbers_valid: bool = False
    target_matched: bool = False
    hack_detected: bool = False
    reason: str = ""


class SampleRollout(BaseModel):
    index: int
    raw_text: str
    think_text: str
    answer_text: str
    num_tokens: int
    mean_log_prob: float
    reward: float
    advantage: float
    breakdown: RewardBreakdown
    token_probs: list[TokenProbInfo] = Field(default_factory=list)


class StepMetrics(BaseModel):
    step: int
    accuracy: float
    mean_reward: float
    reward_std: float
    mean_response_length: float
    entropy: float
    kl_divergence: float
    clip_fraction: float = 0.0
    loss: float = 0.0
    grad_norm: float = 0.0
    zero_grad_step: bool = False
    vram_allocated_gb: float = 0.0
    vram_peak_gb: float = 0.0
    step_time_sec: float = 0.0


class StepLog(BaseModel):
    step: int
    prompt_numbers: list[int]
    prompt_target: int
    prompt_solution: str
    metrics: StepMetrics
    group_mean_reward: float
    group_std_reward: float
    zero_grad_group: bool = False
    samples: list[SampleRollout] = Field(default_factory=list)


class RunMetadata(BaseModel):
    run_id: str
    preset_id: str
    lesson_id: str
    algorithm: Literal["sft_probe", "reinforce", "grpo", "ppo_grpo", "dpo"]
    model_name: str = "Qwen/Qwen2.5-0.5B-Instruct"
    dtype: str = "bfloat16"
    lora_rank: int = 16
    group_size: int = 6
    max_new_tokens: int = 256
    kl_beta: float = 0.04
    clip_eps: float = 0.2
    update_epochs: int = 1
    learning_rate: float = 5e-5
    use_format_reward: bool = True
    check_numbers_exact: bool = True
    reward_shift: float = 0.0
    use_baseline: bool = True
    is_mock: bool = False
    created_at: str = ""


class RunLog(BaseModel):
    schema_version: str = "1.0.0"
    metadata: RunMetadata
    steps: list[StepLog] = Field(default_factory=list)


class DryRunRequest(BaseModel):
    lesson_id: str
    code: str


class DryRunResult(BaseModel):
    ok: bool
    elapsed_ms: float
    backend: Literal["torch", "numpy-shim"]
    checks: list[dict[str, object]] = Field(default_factory=list)
    summary: str
    error_line: int | None = None
    error_detail: str | None = None


class StartTrainRequest(BaseModel):
    preset_id: str = "baseline_grpo"
    lesson_id: str = "lesson-3"
    speed_mode: Literal["fast", "full"] = "fast"
    total_steps: int | None = None
    group_size: int | None = None
    kl_beta: float | None = None
    update_epochs: int | None = None
    use_format_reward: bool | None = None
    check_numbers_exact: bool | None = None
    reward_shift: float | None = None
    custom_code: str | None = None


class DeviceTelemetry(BaseModel):
    device_type: Literal["cuda", "mps", "cpu"]
    device_name: str
    recommended_dtype: str
    total_vram_gb: float
    allocated_vram_gb: float
    reserved_vram_gb: float
    torch_available: bool
    transformers_available: bool
    peft_available: bool
    hf_endpoint: str
    mock_mode: bool
