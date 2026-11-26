"""CPU-only public CLI checks. All files/answers below are synthetic."""

from itertools import combinations, islice
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify_operator_pairs.py"


def fixture(seed):
    groups = combinations(range(2, 29), 3)
    train = list(islice(groups, 1800))
    valid = list(islice(groups, 240))
    test = []
    for i, (a, b, c) in enumerate(islice(groups, 600)):
        k = i % 3
        op = "+-*"[k]
        wrong = "+-*"[(k + 1) % 3]
        target = (a + b + c, a - b + c, a * b + c)[k]
        # 10 gains, 2 losses, 100 stable hits, 488 stable misses.
        before = op if 10 <= i < 112 else wrong
        after = op if i < 10 or 12 <= i < 112 else wrong
        if seed == 2027:
            before, after = after, before
        elif seed == 2028:
            after = before
        test.append(dict(a=a, b=b, c=c, target=target, before=before, after=after))
    return dict(seed=seed, train_triples=train, valid_triples=valid, test=test,
                curve=[dict(step=0, correct=100, total=len(valid))])


class OperatorPairsTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)

    def write(self, file_seed, data):
        (self.root / f"seed-{file_seed}.json").write_text(json.dumps(data), encoding="utf-8")

    def invoke(self, success):
        result = subprocess.run([sys.executable or "python3", "-ISB", str(SCRIPT), "--input-dir", str(self.root)],
                                cwd=self.root, capture_output=True, text=True, timeout=30)
        report = json.loads(result.stdout)  # one JSON document, no progress logs
        if success:
            self.assertEqual(result.returncode, 0, report)
        else:
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(set(report), {"error"})  # never partial per-seed results
        return report

    def test_paired_estimates_per_seed(self):
        for seed in (2026, 2027, 2028):
            self.write(seed, fixture(seed))
        report = self.invoke(True)
        self.assertEqual(report, self.invoke(True))  # reproducible CI
        runs = report["seeds"]
        self.assertEqual(set(runs), {"2026", "2027", "2028"})
        for seed, counts in [("2026", (102, 110, 10, 2)), ("2027", (110, 102, 2, 10)),
                             ("2028", (102, 102, 0, 0))]:
            r = runs[seed]
            self.assertEqual(r["n"], 600)
            self.assertEqual(r["operator_counts"], {"+": 200, "-": 200, "*": 200})
            self.assertEqual((r["before_correct"], r["after_correct"],
                              r["wrong_to_right"], r["right_to_wrong"]), counts)
            self.assertEqual(r["accuracy_delta"], (counts[1] - counts[0]) / 600)
            # For n=12 discordances, smaller tail is (1 + 12 + 66) / 4096.
            self.assertEqual(r["mcnemar_p"], 1 if seed == "2028" else 158 / 4096)
        lo, hi = runs["2026"]["bootstrap_ci95"]
        self.assertLess(0, lo)
        self.assertLess(lo, 8 / 600)
        self.assertLess(8 / 600, hi)
        self.assertEqual(runs["2027"]["bootstrap_ci95"], [-hi, -lo])
        # Independent resampling of these non-constant marginals would not give [0, 0].
        self.assertEqual(runs["2028"]["bootstrap_ci95"], [0, 0])

    def test_rejects_duplicate_groups_even_permuted(self):
        for source, destination in [("train", "valid"), ("train", "test"), ("valid", "test"),
                                    ("train", "train"), ("valid", "valid"), ("test", "test")]:
            with self.subTest(source=source, destination=destination):
                d = fixture(2026)
                triple = (tuple(d["test"][0][k] for k in "abc") if source == "test"
                          else d[source + "_triples"][0])
                if destination == "test":
                    d["test"][1].update(zip("abc", reversed(triple)))
                else:
                    d[destination + "_triples"][1] = triple[::-1]
                self.write(2026, d)
                self.assertIn("repeated number combination", self.invoke(False)["error"])

    def test_validates_identity_not_just_same_set_or_same_multiset_of_operators(self):
        for seed in (2026, 2027, 2028):
            d = fixture(2028)  # zero discordance makes preceding seed checks inexpensive
            d["seed"] = seed
            self.write(seed, d)
        for change in ("reorder", "operands", "target"):
            with self.subTest(change=change):
                d = fixture(2028)
                rows = d["test"]
                if change == "reorder":
                    rows[0], rows[1] = rows[1], rows[0]
                elif change == "operands":
                    rows[0]["a"], rows[0]["b"] = rows[0]["b"], rows[0]["a"]
                else:
                    rows[0]["target"] = rows[0]["a"] - rows[0]["b"] + rows[0]["c"]
                self.write(2028, d)
                error = self.invoke(False)["error"]
                self.assertIn("seed-2028.json", error)
                self.assertIn("item or order differs", error)

    def test_invalid_inputs_are_not_silently_scored(self):
        for mutate, error in [
            (lambda d: d.update(seed=2027), "seed must be"),
            (lambda d: d["test"].pop(), "600 rows"),
            (lambda d: d["test"][0].update(after="/"), "before/after"),
            (lambda d: d["test"][0].update(before=None), "before/after"),
            (lambda d: d["test"][0].update(a=True), "three integers"),
            (lambda d: d["test"][0].update(target=-9999), "exactly one operator"),
            (lambda d: d["test"][0].update(a=2, b=2, c=3, target=7), "exactly one operator"),
            (lambda d: d["test"][0].update(target=d["test"][0]["target"] - 2 * d["test"][0]["b"]),
             "200 targets per operator"),
            (lambda d: d["curve"][0].update(test_correct=17), "curve[0]"),
            (lambda d: d["curve"][0].update(total=600), "denominator"),
        ]:
            with self.subTest(error=error):
                d = fixture(2026)
                mutate(d)
                self.write(2026, d)
                self.assertIn(error, self.invoke(False)["error"])

    def test_missing_or_invalid_json_is_an_error(self):
        self.assertIn("seed-2026.json", self.invoke(False)["error"])
        (self.root / "seed-2026.json").write_text("{", encoding="utf-8")
        self.assertIn("seed-2026.json", self.invoke(False)["error"])


if __name__ == "__main__":
    unittest.main()
