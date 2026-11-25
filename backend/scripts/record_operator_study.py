"""A preregistered one-action arithmetic bandit; see experiments/operator-select/protocol.md."""
from __future__ import annotations

import argparse
import itertools
import json
import random
from pathlib import Path

OPS = ['+', '-', '*']


def outputs(a, b, c):
    return (a + b + c, a - b + c, a * b + c)


def questions():
    rng = random.Random(74103)
    triples = list(itertools.combinations(range(2, 29), 3))
    rng.shuffle(triples)
    splits = []
    for size in [1800, 240, 600]:
        triples_part, triples = triples[:size], triples[size:]
        ops = list(range(3)) * (size // 3)
        rng.shuffle(ops)
        rows = []
        for triple, op in zip(triples_part, ops):
            a, b, c = rng.sample(triple, 3)
            vals = outputs(a, b, c)
            assert len(set(vals)) == 3
            rows.append(dict(a=a, b=b, c=c, target=vals[op]))
        splits.append(rows)
    return splits


def magnitude_baseline(train, test):
    # Fit the best two training-only thresholds: small -> minus, medium -> plus, large -> times.
    bins = sorted({r['target'] for r in train})
    counts = {t: [0, 0, 0] for t in bins}
    for r in train:
        counts[r['target']][outputs(r['a'], r['b'], r['c']).index(r['target'])] += 1
    best, lo, hi = -1, 0, 0
    for i, t in enumerate(bins):
        score = sum(counts[v][1] for v in bins[:i + 1]) + sum(counts[v][2] for v in bins[i + 1:])
        for j in range(i, len(bins)):
            if j > i:
                score += counts[bins[j]][0] - counts[bins[j]][2]
            if score > best:
                best, lo, hi = score, t, bins[j]
    hits = sum(outputs(r['a'], r['b'], r['c'])[1 if r['target'] <= lo else 0 if r['target'] <= hi else 2] == r['target'] for r in test)
    return dict(lo=lo, hi=hi, train_correct=best, test_correct=hits)


def run(seed, model_path, dest):
    import torch
    from transformers import set_seed
    from llm_rl_lab.trainer import RealGPUTrainer

    set_seed(seed)
    rng = random.Random(seed)
    assert torch.cuda.is_available(), 'CUDA is required'
    trainer = RealGPUTrainer(model_path=model_path)
    model, tok, device, dtype = trainer._ensure_model()
    model.gradient_checkpointing_disable()
    train, valid, test = questions()
    opts = [tok.encode(op, add_special_tokens=False) for op in OPS]
    assert all(len(ids) == 1 for ids in opts) and len(set(ids[0] for ids in opts)) == 3
    ids = torch.tensor([x[0] for x in opts], device=device)

    def encode(rows):
        prompts = [tok.apply_chat_template([{'role':'user', 'content':
            f"Fill ? with +, -, or *. Reply with just the operator.\n({r['a']} ? {r['b']}) + {r['c']} = {r['target']}"}],
            tokenize=False, add_generation_prompt=True) for r in rows]
        return tok(prompts, padding=True, return_tensors='pt').to(device)

    def forward(data, idx):
        mask = data.attention_mask[idx]
        all_logits = model(input_ids=data.input_ids[idx], attention_mask=mask,
                           position_ids=(mask.cumsum(-1) - 1).clamp(min=0), use_cache=False,
                           logits_to_keep=1).logits
        return all_logits[:, -1, ids].float()

    def predict(data):
        model.eval()
        with torch.inference_mode():
            return [op for s in range(0, len(data.input_ids), 24)
                    for op in forward(data, slice(s, s+24)).argmax(-1).tolist()]

    def count(rows, preds):
        return sum(outputs(r['a'], r['b'], r['c'])[op] == r['target'] for r, op in zip(rows, preds))

    train_inputs, val_inputs = encode(train), encode(valid)
    def validate(step):
        correct = count(valid, predict(val_inputs))
        print(f'seed {seed} | step {step} | validation {correct}/{len(valid)}', flush=True)
        return dict(step=step, correct=correct, total=len(valid))

    curve = [validate(0)]
    params = [p for p in model.parameters() if p.requires_grad]
    optim = torch.optim.AdamW(params, lr=1.2e-4)
    nums = torch.tensor([[r[k] for k in ('a','b','c','target')] for r in train], device=device)
    for step in range(1, 241):
        model.train()
        idx = rng.sample(range(len(train)), 24)
        logits = forward(train_inputs, idx)
        pi = .8 * (logits / 1.4).softmax(-1) + .2 / 3
        actions = torch.multinomial(pi.detach(), 12, replacement=True)
        a,b,c,target = nums[idx].T.unsqueeze(-1)
        value = torch.where(actions == 0, a+b, torch.where(actions == 1, a-b, a*b)) + c
        rewards = (value == target).float()
        advantage = rewards - rewards.mean(-1, keepdim=True)
        loss = -(pi.log().gather(1, actions) * advantage).mean() + .025 * (pi * pi.log()).sum(-1).mean()
        optim.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(params, 1.0, error_if_nonfinite=True)
        optim.step()
        if step % 20 == 0:
            curve.append(validate(step))

    # Only the final checkpoint sees test inputs. Adapter-disabled scoring recovers frozen weights.
    test_inputs = encode(test)
    with model.disable_adapter():
        before = predict(test_inputs)
    after = predict(test_inputs)
    records = [dict(**r,before=OPS[b],after=OPS[a]) for r,b,a in zip(test,before,after)]
    triples = lambda rows:[[r['a'],r['b'],r['c']] for r in rows]
    data = dict(seed=seed, model=trainer.model_name, device=torch.cuda.get_device_name(), dtype=str(dtype),
                curve=curve, train_triples=triples(train), valid_triples=triples(valid), test=records,
                magnitude_only=magnitude_baseline(train, test))
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / f'seed-{seed}.json'
    tmp = path.with_suffix('.tmp'); tmp.write_text(json.dumps(data, separators=(',', ':'))+'\n'); tmp.replace(path)
    print(f'Recorded {path}', flush=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--seed', required=True, type=int, choices=[2026,2027,2028])
    p.add_argument('--model-path', required=True)
    p.add_argument('--out', type=Path, default=Path('experiments/operator-select'))
    args = p.parse_args()
    run(args.seed, args.model_path, args.out)
