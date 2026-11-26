"""Verify fixed test items, then report paired before/after results for each seed.

Run from the repository root: python3 backend/scripts/verify_operator_pairs.py
Pass --input-dir to read seed-{2026,2027,2028}.json from a different directory.
No model, training code, or third-party packages are required.
"""

import argparse
from collections import Counter
import json
from math import comb
from pathlib import Path
from random import Random
from statistics import quantiles


SEEDS = (2026, 2027, 2028)
PER_OPERATOR = 200
BOOTSTRAP_DRAWS = 10_000
BOOTSTRAP_SEED = 74103
OPS = ("+", "-", "*")
DEFAULT_DIR = Path(__file__).resolve().parents[2] / "experiments/operator-select"


def mcnemar_p(wrong_to_right, right_to_wrong):
    """Two-sided exact binomial test on discordant pairs (ties/no changes: 1)."""
    n = wrong_to_right + right_to_wrong
    tail = sum(comb(n, k) for k in range(min(wrong_to_right, right_to_wrong) + 1))
    return min(1.0, (2 * tail) / (1 << n))


def paired_ci95(deltas):
    """Percentile CI for mean(after_correct - before_correct), resampling items."""
    if min(deltas) == max(deltas):
        return [float(deltas[0]), float(deltas[0])]
    rng = Random(BOOTSTRAP_SEED)
    n = len(deltas)
    totals = (sum(rng.choices(deltas, k=n)) for _ in range(BOOTSTRAP_DRAWS))
    cuts = quantiles(totals, n=40, method="inclusive")
    return [cuts[0] / n, cuts[-1] / n]


def claim_triple(values, where, seen):
    if not isinstance(values, list) or len(values) != 3 or any(type(x) is not int for x in values):
        raise ValueError(f"{where}: expected three integers")
    # Order matters for arithmetic but not for reuse of a number combination.
    key = tuple(sorted(values))
    if key in seen:
        raise ValueError(f"{where}: repeated number combination {key}, first used at {seen[key]}")
    seen[key] = where


def check_curve(curve, valid_size):
    """Only accept the recorder's validation series; never use it for scoring."""
    if not isinstance(curve, list):
        raise ValueError("curve: expected an array of validation points")
    for i, point in enumerate(curve):
        if not isinstance(point, dict) or point.keys() != {"step", "correct", "total"}:
            raise ValueError(f"curve[{i}]: expected only step, correct, total")
        if (any(type(x) is not int for x in point.values()) or point["step"] < 0
                or point["total"] != valid_size or not 0 <= point["correct"] <= valid_size):
            raise ValueError(f"curve[{i}]: invalid validation step, count or denominator")


def verify_seed(data, seed, reference):
    if not isinstance(data, dict) or type(data.get("seed")) is not int or data["seed"] != seed:
        raise ValueError(f"seed must be {seed}")
    seen = {}
    for split in ("train_triples", "valid_triples"):
        triples = data.get(split)
        if not isinstance(triples, list):
            raise ValueError(f"{split}: expected an array of triples")
        for i, triple in enumerate(triples):
            claim_triple(triple, f"{split}[{i}]", seen)
    check_curve(data.get("curve"), len(data["valid_triples"]))

    test = data.get("test")
    if not isinstance(test, list) or len(test) != PER_OPERATOR * len(OPS):
        raise ValueError("test: expected exactly 600 rows")
    items, deltas = [], []
    op_counts = Counter()
    before_correct = 0
    for i, row in enumerate(test):
        where = f"test[{i}]"
        if not isinstance(row, dict):
            raise ValueError(f"{where}: expected a row object")
        triple = [row.get(k) for k in ("a", "b", "c")]
        claim_triple(triple, where, seen)
        a, b, c = triple
        target = row.get("target")
        if type(target) is not int:
            raise ValueError(f"{where}.target: expected an integer")
        item = (a, b, c, target)
        if reference is not None and item != reference[i]:
            raise ValueError(f"{where}: item or order differs from seed {SEEDS[0]}")
        items.append(item)
        results = {"+": (a + b) + c, "-": (a - b) + c, "*": (a * b) + c}
        gold = [op for op, result in results.items() if result == target]
        if len(gold) != 1:
            raise ValueError(f"{where}: expected exactly one operator that reaches target")
        op_counts[gold[0]] += 1
        before, after = row.get("before"), row.get("after")
        if before not in OPS or after not in OPS:
            raise ValueError(f"{where}: before/after must be '+', '-' or '*'")
        hit_before, hit_after = results[before] == target, results[after] == target
        before_correct += hit_before
        deltas.append(hit_after - hit_before)

    if any(op_counts[op] != PER_OPERATOR for op in OPS):
        raise ValueError(f"test: expected 200 targets per operator, got {dict(op_counts)}")
    gained, lost = deltas.count(1), deltas.count(-1)
    after_correct = before_correct + gained - lost
    n = len(items)
    return items, {
        "n": n,
        "operator_counts": dict(op_counts),
        "before_correct": before_correct,
        "after_correct": after_correct,
        "before_accuracy": before_correct / n,
        "after_accuracy": after_correct / n,
        "wrong_to_right": gained,
        "right_to_wrong": lost,
        "accuracy_delta": (gained - lost) / n,
        "mcnemar_p": mcnemar_p(gained, lost),
        "bootstrap_ci95": paired_ci95(deltas),
    }


def verify(input_dir):
    reference = None
    seeds = {}
    for seed in SEEDS:
        path = input_dir / f"seed-{seed}.json"
        try:
            with path.open(encoding="utf-8") as f:
                items, seeds[str(seed)] = verify_seed(json.load(f), seed, reference)
        except (OSError, ValueError) as exc:
            raise ValueError(f"{path}: {exc}") from exc
        if reference is None:
            reference = items
    return {
        "seeds": seeds,
        "bootstrap": {
            "estimand": "after_accuracy - before_accuracy",
            "method": "paired item percentile (linear 2.5%, 97.5%)",
            "replicates": BOOTSTRAP_DRAWS,
            "rng_seed": BOOTSTRAP_SEED,
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_DIR)
    args = parser.parse_args()
    try:
        report = verify(args.input_dir)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        return 1
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
