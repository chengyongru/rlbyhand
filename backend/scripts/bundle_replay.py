"""Verify raw RunLogs before installing them as the static replay (no synthetic fallback)."""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from llm_rl_lab.config import PRESETS
from llm_rl_lab.countdown import verify_countdown
from llm_rl_lab.schema import RunLog


def checked_run(path: Path, preset: str) -> RunLog:
    log = RunLog.model_validate_json(path.read_bytes())
    meta = log.metadata
    if meta.is_mock or not meta.run_id.startswith('gpu-') or meta.preset_id != preset or not log.steps:
        raise ValueError(f'{path}: missing or incorrect recording')
    for i, s in enumerate(log.steps):
        m = s.metrics
        if s.step != i or m.step != i or len(s.samples) != meta.group_size:
            raise ValueError(f'{preset}/{i}: incomplete step')
        if not all(math.isfinite(v) for v in m.model_dump().values()) or m.vram_peak_gb <= 0:
            raise ValueError(f'{preset}/{i}: invalid measurements')
        hits = 0
        for sample in s.samples:
            b = verify_countdown(sample.raw_text, s.prompt_numbers, s.prompt_target,
                                 use_format_reward=meta.use_format_reward,
                                 check_numbers_exact=meta.check_numbers_exact, reward_shift=meta.reward_shift)
            if b != sample.breakdown or b.total_reward != sample.reward:
                raise ValueError(f'{preset}/{i}: cannot reproduce reward')
            hits += int(b.numbers_valid and b.target_matched)
        if abs(hits / meta.group_size - m.accuracy) > 0.0001:
            raise ValueError(f'{preset}/{i}: incorrect accuracy')
        trace = s.samples[0].token_probs
        if not trace or len(trace) != s.samples[0].num_tokens or any(len(t.top_candidates) != 5 for t in trace):
            raise ValueError(f'{preset}/{i}: missing token observations')
    return log


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('directory', type=Path)
    p.add_argument('bundle', type=Path)
    args = p.parse_args()
    runs = {k: checked_run(args.directory / f'{k}.json', k) for k in PRESETS}
    ref = [(s.prompt_numbers, s.prompt_target) for s in runs['baseline_grpo'].steps]
    for k, run in runs.items():
        if k != 'sft_probe' and [(s.prompt_numbers, s.prompt_target) for s in run.steps] != ref:
            raise ValueError(f'{k}: comparison steps do not match the baseline')
    tmp = args.bundle.with_suffix('.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        f.write('{')
        for i, (name, run) in enumerate(runs.items()):
            if i:
                f.write(',\n')
            f.write(json.dumps(name) + ':' + run.model_dump_json())
        f.write('}\n')
    tmp.replace(args.bundle)
