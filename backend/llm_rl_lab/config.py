"""Configuration, experiment presets, and hardware capability detection."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .schema import DeviceTelemetry


@dataclass(frozen=True)
class ExperimentPreset:
    preset_id: str
    lesson_id: str
    algorithm: str
    total_steps_fast: int
    total_steps_full: int
    group_size: int
    kl_beta: float
    clip_eps: float
    update_epochs: int
    learning_rate: float
    use_format_reward: bool = True
    check_numbers_exact: bool = True
    reward_shift: float = 0.0
    use_baseline: bool = True
    temperature: float = 0.85


PRESETS: dict[str, ExperimentPreset] = {
    "sft_probe": ExperimentPreset(
        preset_id="sft_probe",
        lesson_id="lesson-1",
        algorithm="sft_probe",
        total_steps_fast=20,
        total_steps_full=40,
        group_size=4,
        kl_beta=0.0,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=5e-5,
    ),
    "reinforce_basic": ExperimentPreset(
        preset_id="reinforce_basic",
        lesson_id="lesson-2",
        algorithm="reinforce",
        total_steps_fast=40,
        total_steps_full=120,
        group_size=6,
        kl_beta=0.02,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=5e-5,
        use_baseline=False,
    ),
    "no_format_reward": ExperimentPreset(
        preset_id="no_format_reward",
        lesson_id="lesson-2",
        algorithm="reinforce",
        total_steps_fast=40,
        total_steps_full=120,
        group_size=6,
        kl_beta=0.02,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=5e-5,
        use_format_reward=False,
        use_baseline=False,
    ),
    "baseline_grpo": ExperimentPreset(
        preset_id="baseline_grpo",
        lesson_id="lesson-3",
        algorithm="grpo",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.04,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=5e-5,
        use_baseline=True,
    ),
    "reward_shift_plus10": ExperimentPreset(
        preset_id="reward_shift_plus10",
        lesson_id="lesson-3",
        algorithm="reinforce",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.02,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=5e-5,
        reward_shift=10.0,
        use_baseline=False,
    ),
    "ppo_multi_epoch": ExperimentPreset(
        preset_id="ppo_multi_epoch",
        lesson_id="lesson-4",
        algorithm="ppo_grpo",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.04,
        clip_eps=0.2,
        update_epochs=4,
        learning_rate=5e-5,
    ),
    "kl_zero_collapse": ExperimentPreset(
        preset_id="kl_zero_collapse",
        lesson_id="lesson-4",
        algorithm="ppo_grpo",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.0,
        clip_eps=10.0,
        update_epochs=4,
        learning_rate=8e-5,
    ),
    "reward_hacking": ExperimentPreset(
        preset_id="reward_hacking",
        lesson_id="lesson-5",
        algorithm="grpo",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.02,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=6e-5,
        check_numbers_exact=False,
    ),
    "entropy_collapse": ExperimentPreset(
        preset_id="entropy_collapse",
        lesson_id="lesson-5",
        algorithm="grpo",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.005,
        clip_eps=0.2,
        update_epochs=2,
        learning_rate=7e-5,
        temperature=0.25,
    ),
    "offline_dpo": ExperimentPreset(
        preset_id="offline_dpo",
        lesson_id="lesson-6",
        algorithm="dpo",
        total_steps_fast=40,
        total_steps_full=150,
        group_size=6,
        kl_beta=0.1,
        clip_eps=0.2,
        update_epochs=1,
        learning_rate=3e-5,
    ),
}


def detect_device_telemetry(mock_mode: bool = False) -> DeviceTelemetry:
    """Detect available PyTorch accelerator, recommended dtype, and VRAM stats."""
    hf_endpoint = os.environ.get("HF_ENDPOINT", "https://huggingface.co")
    torch_ok = False
    transformers_ok = False
    peft_ok = False

    try:
        import transformers  # noqa: F401

        transformers_ok = True
    except ImportError:
        pass

    try:
        import peft  # noqa: F401

        peft_ok = True
    except ImportError:
        pass

    try:
        import torch

        torch_ok = True
        if torch.cuda.is_available():
            idx = torch.cuda.current_device()
            props = torch.cuda.get_device_properties(idx)
            major, _ = torch.cuda.get_device_capability(idx)
            dtype = "bfloat16" if major >= 8 else "float16"
            total_gb = round(props.total_memory / (1024**3), 2)
            alloc_gb = round(torch.cuda.memory_allocated(idx) / (1024**3), 2)
            reserved_gb = round(torch.cuda.memory_reserved(idx) / (1024**3), 2)
            return DeviceTelemetry(
                device_type="cuda",
                device_name=props.name,
                recommended_dtype=dtype,
                total_vram_gb=total_gb,
                allocated_vram_gb=alloc_gb,
                reserved_vram_gb=reserved_gb,
                torch_available=True,
                transformers_available=transformers_ok,
                peft_available=peft_ok,
                hf_endpoint=hf_endpoint,
                mock_mode=mock_mode,
            )
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return DeviceTelemetry(
                device_type="mps",
                device_name="Apple Silicon (MPS)",
                recommended_dtype="float16",
                total_vram_gb=16.0,
                allocated_vram_gb=0.0,
                reserved_vram_gb=0.0,
                torch_available=True,
                transformers_available=transformers_ok,
                peft_available=peft_ok,
                hf_endpoint=hf_endpoint,
                mock_mode=mock_mode,
            )
    except ImportError:
        pass

    return DeviceTelemetry(
        device_type="cpu",
        device_name="CPU (Mock / Preview Ready)" if mock_mode else "CPU Only",
        recommended_dtype="float32",
        total_vram_gb=0.0,
        allocated_vram_gb=0.0,
        reserved_vram_gb=0.0,
        torch_available=torch_ok,
        transformers_available=transformers_ok,
        peft_available=peft_ok,
        hf_endpoint=hf_endpoint,
        mock_mode=mock_mode,
    )
