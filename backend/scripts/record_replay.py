"""Record one seeded GPU experiment from fresh weights, without starting the web server."""
from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

import torch
from transformers import set_seed

from llm_rl_lab.config import PRESETS
from llm_rl_lab.schema import RunLog, StartTrainRequest
from llm_rl_lab.trainer import RealGPUTrainer


async def record(args):
    if not torch.cuda.is_available():
        raise RuntimeError('Recording requires CUDA; refusing CPU/mock fallback')
    set_seed(args.seed)
    preset = PRESETS[args.preset]
    probe = RunLog.model_validate_json(args.probe.read_bytes()) if args.probe else None
    trainer = RealGPUTrainer(model_path=args.model_path)
    req = StartTrainRequest(preset_id=args.preset, lesson_id=preset.lesson_id,
                            total_steps=args.steps or preset.total_steps_fast, group_size=args.group_size)

    async def emit(event):
        if event['type'] == 'step':
            s = event['step']; m = s['metrics']
            print(f"{args.preset} {s['step'] + 1}/{req.total_steps} acc={m['accuracy']} "
                  f"reward={m['mean_reward']} grad={m['grad_norm']} peak={m['vram_peak_gb']}GiB "
                  f"time={m['step_time_sec']}s", flush=True)
        elif event['type'] == 'log':
            print(event['message'], flush=True)

    # Freeze DPO pairs from the separate, untrained probe; use the same online prompt stream
    # for every training condition. The DPO training pairs never come from that stream.
    run = await trainer.run(req, emit, asyncio.Event(), args.out,
                            data_seed=123 if args.preset == 'sft_probe' else 42,
                            record_tokens=True, offline_probe=probe)
    if len(run.steps) != req.total_steps or run.metadata.is_mock:
        raise RuntimeError('Incomplete GPU run')
    dest = args.out / f'{args.preset}.json'
    tmp = dest.with_suffix('.tmp'); tmp.write_text(run.model_dump_json(), encoding='utf-8'); tmp.replace(dest)
    print(f'Recorded {dest}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('preset', choices=list(PRESETS))
    parser.add_argument('--model-path', help='Optional local snapshot of Qwen2.5-0.5B-Instruct')
    parser.add_argument('--steps', type=int)
    parser.add_argument('--group-size', type=int)
    parser.add_argument('--seed', type=int, default=2026)
    parser.add_argument('--probe', type=Path, help='Frozen sft_probe RunLog for offline_dpo')
    parser.add_argument('--out', type=Path, default=Path('runs/capture'))
    asyncio.run(record(parser.parse_args()))
