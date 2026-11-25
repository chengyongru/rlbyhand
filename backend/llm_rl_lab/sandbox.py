"""1-second Dry-Run validator for user-edited surgical code snippets.

Validates syntax, return shape (scalar), gradient flow (requires_grad / grad_fn),
and numerical finiteness (no NaN/Inf) on tiny dummy tensors BEFORE launching GPU training.
"""

from __future__ import annotations

import ast
import math
import time
import traceback
from typing import Any

import numpy as np

from .countdown import safe_eval_expr
from .schema import DryRunResult

FORBIDDEN_IMPORTS = {
    "os",
    "sys",
    "subprocess",
    "shutil",
    "socket",
    "pathlib",
    "urllib",
    "http",
    "requests",
    "ctypes",
    "importlib",
}


class _MiniTensor:
    """Minimal NumPy-backed tensor shim supporting basic torch-like ops for CPU-only dry-runs."""

    def __init__(self, data: Any, requires_grad: bool = False, grad_fn: str | None = None):
        self.data = np.asarray(data, dtype=np.float64)
        self.requires_grad = requires_grad
        self.grad_fn = grad_fn or ("LeafGrad" if requires_grad else None)

    @property
    def shape(self) -> tuple[int, ...]:
        return self.data.shape

    def _wrap(self, arr: Any, other: Any = None, op: str = "Op") -> _MiniTensor:
        req = self.requires_grad or (isinstance(other, _MiniTensor) and other.requires_grad)
        return _MiniTensor(arr, requires_grad=req, grad_fn=op if req else None)

    def _val(self, other: Any) -> Any:
        return other.data if isinstance(other, _MiniTensor) else other

    def __add__(self, other: Any) -> _MiniTensor:
        return self._wrap(self.data + self._val(other), other, "AddBackward")

    def __radd__(self, other: Any) -> _MiniTensor:
        return self._wrap(self._val(other) + self.data, other, "AddBackward")

    def __sub__(self, other: Any) -> _MiniTensor:
        return self._wrap(self.data - self._val(other), other, "SubBackward")

    def __rsub__(self, other: Any) -> _MiniTensor:
        return self._wrap(self._val(other) - self.data, other, "SubBackward")

    def __mul__(self, other: Any) -> _MiniTensor:
        return self._wrap(self.data * self._val(other), other, "MulBackward")

    def __rmul__(self, other: Any) -> _MiniTensor:
        return self._wrap(self._val(other) * self.data, other, "MulBackward")

    def __truediv__(self, other: Any) -> _MiniTensor:
        return self._wrap(self.data / self._val(other), other, "DivBackward")

    def __neg__(self) -> _MiniTensor:
        return self._wrap(-self.data, None, "NegBackward")

    def mean(self, dim: int | None = None) -> _MiniTensor:
        return self._wrap(np.mean(self.data, axis=dim), None, "MeanBackward")

    def sum(self, dim: int | None = None) -> _MiniTensor:
        return self._wrap(np.sum(self.data, axis=dim), None, "SumBackward")

    def std(self, unbiased: bool = False) -> _MiniTensor:
        ddof = 1 if unbiased else 0
        return self._wrap(np.std(self.data, ddof=ddof), None, "StdBackward")

    def unsqueeze(self, dim: int) -> _MiniTensor:
        return self._wrap(np.expand_dims(self.data, axis=dim), None, "UnsqueezeBackward")

    def clamp(self, min: float | None = None, max: float | None = None) -> _MiniTensor:
        return self._wrap(np.clip(self.data, min, max), None, "ClampBackward")

    def detach(self) -> _MiniTensor:
        return _MiniTensor(self.data.copy(), requires_grad=False, grad_fn=None)

    def float(self) -> _MiniTensor:
        return self

    def abs(self) -> _MiniTensor:
        return self._wrap(np.abs(self.data), None, "AbsBackward")

    def exp(self) -> _MiniTensor:
        return self._wrap(np.exp(np.clip(self.data, -30, 30)), None, "ExpBackward")

    def item(self) -> float:
        return float(np.asarray(self.data).reshape(-1)[0])


class _TorchShim:
    Tensor = _MiniTensor

    @staticmethod
    def tensor(data: Any, requires_grad: bool = False) -> _MiniTensor:
        return _MiniTensor(data, requires_grad=requires_grad)

    @staticmethod
    def exp(x: _MiniTensor) -> _MiniTensor:
        return x.exp()

    @staticmethod
    def clamp(x: _MiniTensor, min: float | None = None, max: float | None = None) -> _MiniTensor:
        return x.clamp(min=min, max=max)

    @staticmethod
    def minimum(a: _MiniTensor, b: _MiniTensor) -> _MiniTensor:
        return _MiniTensor(
            np.minimum(a.data, b.data),
            requires_grad=a.requires_grad or b.requires_grad,
            grad_fn="MinimumBackward" if (a.requires_grad or b.requires_grad) else None,
        )

    @staticmethod
    def zeros_like(x: _MiniTensor) -> _MiniTensor:
        return _MiniTensor(np.zeros_like(x.data), requires_grad=False)

    class nn:  # noqa: N801
        class functional:  # noqa: N801
            @staticmethod
            def logsigmoid(x: _MiniTensor) -> _MiniTensor:
                arr = -np.logaddexp(0.0, -x.data)
                return _MiniTensor(arr, requires_grad=x.requires_grad, grad_fn="LogSigmoidBackward")


def _static_safety_check(code: str) -> tuple[bool, int | None, str | None]:
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return False, exc.lineno, f"SyntaxError: {exc.msg}"

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in FORBIDDEN_IMPORTS:
                    return False, node.lineno, f"Disallowed import '{root}' in lab sandbox"
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if root in FORBIDDEN_IMPORTS:
                return False, node.lineno, f"Disallowed import '{root}' in lab sandbox"
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in {"eval", "exec", "open", "__import__", "compile"}:
                return False, node.lineno, f"Disallowed call '{node.func.id}()' in lab sandbox"
    return True, None, None


def dry_run_user_code(lesson_id: str, code: str) -> DryRunResult:
    """Validate user code for the given lesson on tiny dummy inputs."""
    t0 = time.perf_counter()
    safe_ok, err_line, err_msg = _static_safety_check(code)
    if not safe_ok:
        return DryRunResult(
            ok=False,
            elapsed_ms=round((time.perf_counter() - t0) * 1000, 2),
            backend="numpy-shim",
            checks=[{"name": "syntax_and_safety", "passed": False, "detail": err_msg}],
            summary=err_msg or "Static check failed",
            error_line=err_line,
            error_detail=err_msg,
        )

    try:
        import torch as torch_mod
        import torch.nn.functional as F_mod

        backend_name = "torch"
    except ImportError:
        torch_mod = _TorchShim  # type: ignore[assignment]
        F_mod = _TorchShim.nn.functional  # type: ignore[assignment]
        backend_name = "numpy-shim"

    import re as re_mod

    namespace: dict[str, Any] = {
        "__builtins__": {
            "abs": abs,
            "all": all,
            "any": any,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "float": float,
            "int": int,
            "len": len,
            "list": list,
            "max": max,
            "min": min,
            "range": range,
            "round": round,
            "set": set,
            "sorted": sorted,
            "str": str,
            "sum": sum,
            "tuple": tuple,
            "zip": zip,
        },
        "torch": torch_mod,
        "F": F_mod,
        "math": math,
        "re": re_mod,
        "safe_eval_expr": safe_eval_expr,
    }

    checks: list[dict[str, object]] = [
        {"name": "syntax_and_safety", "passed": True, "detail": "AST verified"}
    ]

    try:
        exec(compile(code, "<lab-editor>", "exec"), namespace)  # noqa: S102

        if lesson_id == "lesson-5":
            fn = namespace.get("compute_reward")
            if not callable(fn):
                raise ValueError("Expected function `compute_reward(completion, numbers, target)`")
            r_good = float(
                fn("<think>3*7+12=33</think><answer>3 * 7 + 12</answer>", [3, 7, 12], 33)
            )
            r_hack = float(fn("<think>just answer</think><answer>33</answer>", [3, 7, 12], 33))
            r_bad = float(fn("<think>wrong</think><answer>3 + 7 + 12</answer>", [3, 7, 12], 33))
            checks.append(
                {
                    "name": "reward_probes",
                    "passed": math.isfinite(r_good) and math.isfinite(r_hack) and math.isfinite(r_bad),
                    "detail": f"valid={r_good:.2f}, shortcut_33={r_hack:.2f}, wrong={r_bad:.2f}",
                }
            )
            hack_warning = (
                "Shortcut `<answer>33</answer>` earns full reward (Reward Hacking active)."
                if r_hack >= 1.0
                else "Exact-number check active; shortcut rejected."
            )
            return DryRunResult(
                ok=True,
                elapsed_ms=round((time.perf_counter() - t0) * 1000, 2),
                backend=backend_name,  # type: ignore[arg-type]
                checks=checks,
                summary=hack_warning,
            )

        logp = torch_mod.tensor(
            [[-0.8, -0.5, -1.1, -0.4, -0.7, -0.3]] * 4,
            requires_grad=True,
        )
        old_logp = torch_mod.tensor(
            [[-0.9, -0.5, -1.0, -0.45, -0.65, -0.35]] * 4,
            requires_grad=False,
        )
        ref_logp = torch_mod.tensor(
            [[-1.0, -0.6, -1.2, -0.5, -0.8, -0.4]] * 4,
            requires_grad=False,
        )
        mask = torch_mod.tensor([[1.0, 1.0, 1.0, 1.0, 0.0, 0.0]] * 4)
        rewards = torch_mod.tensor([1.1, 0.1, 1.1, 0.0])

        if lesson_id == "lesson-1":
            fn = namespace.get("compute_sft_loss")
            if not callable(fn):
                raise ValueError("Expected function `compute_sft_loss(per_token_logp, mask)`")
            out = fn(logp, mask)
        elif lesson_id == "lesson-2":
            fn = namespace.get("reinforce_loss")
            if not callable(fn):
                raise ValueError("Expected function `reinforce_loss(per_token_logp, mask, rewards)`")
            out = fn(logp, mask, rewards)
        elif lesson_id == "lesson-3":
            fn = namespace.get("grpo_loss")
            if not callable(fn):
                raise ValueError(
                    "Expected function `grpo_loss(per_token_logp, ref_logp, mask, rewards, kl_beta=0.04)`"
                )
            out = fn(logp, ref_logp, mask, rewards)
        elif lesson_id == "lesson-4":
            fn = namespace.get("ppo_grpo_loss")
            if not callable(fn):
                raise ValueError(
                    "Expected function `ppo_grpo_loss(logp, old_logp, ref_logp, mask, rewards, clip_eps=0.2, kl_beta=0.04)`"
                )
            out = fn(logp, old_logp, ref_logp, mask, rewards)
        elif lesson_id == "lesson-6":
            fn = namespace.get("dpo_loss")
            if not callable(fn):
                raise ValueError(
                    "Expected function `dpo_loss(pi_chosen, pi_rejected, ref_chosen, ref_rejected, beta=0.1)`"
                )
            pi_c = torch_mod.tensor([-1.2, -0.9], requires_grad=True)
            pi_r = torch_mod.tensor([-2.1, -1.7], requires_grad=True)
            ref_c = torch_mod.tensor([-1.4, -1.1], requires_grad=False)
            ref_r = torch_mod.tensor([-1.9, -1.6], requires_grad=False)
            out = fn(pi_c, pi_r, ref_c, ref_r)
        else:
            raise ValueError(f"Unknown lesson_id: {lesson_id}")

        shape = tuple(out.shape)
        is_scalar = len(shape) == 0 or (len(shape) == 1 and shape[0] == 1)
        val = float(out.item()) if is_scalar else float("nan")
        is_finite = math.isfinite(val)
        has_grad = bool(getattr(out, "requires_grad", False))

        checks.extend(
            [
                {
                    "name": "scalar_output",
                    "passed": is_scalar,
                    "detail": f"shape={shape}, value={val:.4f}" if is_scalar else f"got shape {shape}, expected scalar",
                },
                {
                    "name": "finite_value",
                    "passed": is_finite,
                    "detail": "finite" if is_finite else "NaN or Inf detected",
                },
                {
                    "name": "gradient_flow",
                    "passed": has_grad,
                    "detail": "grad_fn attached" if has_grad else "detached tensor (no gradient to policy!)",
                },
            ]
        )

        all_ok = is_scalar and is_finite and has_grad
        summary = (
            f"All checks passed (loss={val:.4f}, grad_fn ready)."
            if all_ok
            else "Dry-run failed: check scalar shape, finiteness, and gradient flow."
        )
        return DryRunResult(
            ok=all_ok,
            elapsed_ms=round((time.perf_counter() - t0) * 1000, 2),
            backend=backend_name,  # type: ignore[arg-type]
            checks=checks,
            summary=summary,
        )

    except Exception as exc:
        tb = traceback.extract_tb(exc.__traceback__)
        err_lineno = None
        for frame in reversed(tb):
            if frame.filename == "<lab-editor>":
                err_lineno = frame.lineno
                break
        return DryRunResult(
            ok=False,
            elapsed_ms=round((time.perf_counter() - t0) * 1000, 2),
            backend=backend_name,  # type: ignore[arg-type]
            checks=checks + [{"name": "runtime", "passed": False, "detail": str(exc)}],
            summary=f"{type(exc).__name__}: {exc}",
            error_line=err_lineno,
            error_detail=str(exc),
        )
