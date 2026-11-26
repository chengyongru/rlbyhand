"""Countdown task generator, AST-safe arithmetic evaluator, and two-stage RLVR verifier."""

from __future__ import annotations

import ast
import operator
import random
import re
from dataclasses import dataclass

from .schema import RewardBreakdown

THINK_RE = re.compile(r"<think>(.*?)</think>", re.DOTALL)
ANSWER_RE = re.compile(r"<answer>(.*?)</answer>", re.DOTALL)
ALLOWED_EXPR_RE = re.compile(r"^[\d\s\+\-\*\/\(\)\.]+$")
NUMBER_TOKEN_RE = re.compile(r"\d+")

BINARY_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}

UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


@dataclass(frozen=True)
class CountdownProblem:
    numbers: list[int]
    target: int
    solution: str


def safe_eval_expr(expr: str, max_nodes: int = 32) -> float | None:
    """Safely evaluate an arithmetic expression using AST without eval()."""
    cleaned = expr.strip()
    if not cleaned or len(cleaned) > 80 or not ALLOWED_EXPR_RE.match(cleaned):
        return None
    try:
        tree = ast.parse(cleaned, mode="eval")
    except SyntaxError:
        return None

    nodes = list(ast.walk(tree))
    if len(nodes) > max_nodes:
        return None

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.UnaryOp) and type(node.op) in UNARY_OPS:
            return UNARY_OPS[type(node.op)](_eval(node.operand))
        if isinstance(node, ast.BinOp) and type(node.op) in BINARY_OPS:
            left = _eval(node.left)
            right = _eval(node.right)
            if isinstance(node.op, ast.Div) and abs(right) < 1e-12:
                raise ZeroDivisionError("division by zero")
            res = BINARY_OPS[type(node.op)](left, right)
            if abs(res) > 1e9:
                raise OverflowError("value too large")
            return float(res)
        raise ValueError(f"disallowed AST node: {type(node).__name__}")

    try:
        return _eval(tree)
    except (ZeroDivisionError, OverflowError, ValueError, TypeError):
        return None


def generate_countdown_problem(
    rng: random.Random,
    num_count: int = 3,
    min_num: int = 1,
    max_num: int = 15,
    allow_div: bool = False,
    min_target: int = 5,
    max_target: int = 80,
) -> CountdownProblem:
    """Generate a guaranteed-solvable Countdown problem with an exact reference solution."""
    ops = ["+", "-", "*"] + (["/"] if allow_div else [])
    for _ in range(500):
        nums = [rng.randint(min_num, max_num) for _ in range(num_count)]
        # Ensure numbers aren't trivially identical
        if len(set(nums)) < 2:
            continue

        order = nums[:]
        rng.shuffle(order)
        expr = str(order[0])
        val = float(order[0])
        valid = True

        for nxt in order[1:]:
            op = rng.choice(ops)
            if op == "/" and (nxt == 0 or val % nxt != 0):
                op = rng.choice(["+", "-", "*"])
            if op == "+":
                val = val + nxt
                expr = f"({expr} + {nxt})"
            elif op == "-":
                val = val - nxt
                expr = f"({expr} - {nxt})"
            elif op == "*":
                val = val * nxt
                expr = f"({expr} * {nxt})"
            elif op == "/":
                val = val / nxt
                expr = f"({expr} / {nxt})"

        target = int(round(val))
        if (
            valid
            and abs(val - target) < 1e-9
            and min_target <= target <= max_target
            and target not in nums
        ):
            # Strip outer parens for clean display
            if expr.startswith("(") and expr.endswith(")"):
                expr = expr[1:-1]
            return CountdownProblem(numbers=sorted(nums), target=target, solution=expr)

    # Deterministic fallback
    return CountdownProblem(numbers=[3, 7, 12], target=33, solution="3 * 7 + 12")


def generate_countdown_dataset(
    size: int = 512,
    seed: int = 42,
    num_count: int = 3,
    min_num: int = 1,
    max_num: int = 15,
    allow_div: bool = False,
) -> list[CountdownProblem]:
    """Generate a deterministic zero-contamination dataset of Countdown problems."""
    rng = random.Random(seed)
    return [
        generate_countdown_problem(
            rng=rng,
            num_count=num_count,
            min_num=min_num,
            max_num=max_num,
            allow_div=allow_div,
        )
        for _ in range(size)
    ]


def build_countdown_prompt(
    numbers: list[int],
    target: int,
    include_one_shot: bool = True,
    allow_div: bool = False,
) -> str:
    """Build a compact prompt suited for Qwen2.5-0.5B-Instruct under 8GB VRAM."""
    ops_str = "+, -, *, /" if allow_div else "+, -, *"
    header = (
        f"Using the numbers below, form an arithmetic expression equal to the target. "
        f"You may use {ops_str} and parentheses. Each given number must be used exactly once.\n"
        f"Write brief reasoning inside <think>...</think> and ONLY the final expression inside <answer>...</answer>.\n"
    )
    if include_one_shot:
        example = (
            "\nExample:\n"
            "Numbers: [2, 5, 9], Target: 19\n"
            "<think>Try 2 * 5 + 9 = 10 + 9 = 19. Uses 2, 5, 9 once each.</think>\n"
            "<answer>2 * 5 + 9</answer>\n"
        )
    else:
        example = ""
    query = f"\nProblem:\nNumbers: {numbers}, Target: {target}\n"
    return header + example + query


def render_countdown_prompt(tokenizer, numbers: list[int], target: int) -> str:
    """Use the instruction model's assistant turn for both rollout and preference scoring."""
    def question(nums, goal):
        return f"Numbers: {nums}. Target: {goal}."

    return tokenizer.apply_chat_template([
        {"role": "system", "content": "Use all three numbers exactly once with +, -, *, and parentheses to make the target. Reply in exactly two short tags like the examples, without an equals sign in the answer."},
        {"role": "user", "content": question([2, 5, 9], 19)},
        {"role": "assistant", "content": "<think>2 times 5 gives 10; add 9.</think>\n<answer>2 * 5 + 9</answer>"},
        {"role": "user", "content": question([3, 4, 7], 9)},
        {"role": "assistant", "content": "<think>7 minus 4 gives 3; multiply by 3.</think>\n<answer>(7 - 4) * 3</answer>"},
        {"role": "user", "content": question(numbers, target)},
    ], tokenize=False, add_generation_prompt=True)


def verify_countdown(
    completion: str,
    numbers: list[int],
    target: int,
    *,
    use_format_reward: bool = True,
    check_numbers_exact: bool = True,
    reward_shift: float = 0.0,
) -> RewardBreakdown:
    """Two-stage RLVR verifier with explicit toggles for ablation & reward hacking demos."""
    think_match = THINK_RE.search(completion)
    answer_match = ANSWER_RE.search(completion)
    has_think = think_match is not None and len(think_match.group(1).strip()) > 0
    has_answer = answer_match is not None and len(answer_match.group(1).strip()) > 0

    extracted_expr = answer_match.group(1).strip() if answer_match else None
    expr_syntax_ok = bool(extracted_expr and ALLOWED_EXPR_RE.match(extracted_expr))

    format_reward = 0.1 if (use_format_reward and has_think and has_answer and expr_syntax_ok) else 0.0

    if not extracted_expr or not expr_syntax_ok:
        return RewardBreakdown(
            format_reward=format_reward,
            correct_reward=0.0,
            total_reward=round(format_reward + reward_shift, 4),
            has_think_tags=has_think,
            has_answer_tags=has_answer,
            extracted_expr=extracted_expr,
            reason="Missing or malformed <answer> expression",
        )

    used_numbers = sorted(int(tok) for tok in NUMBER_TOKEN_RE.findall(extracted_expr))
    expected_numbers = sorted(numbers)
    numbers_valid = used_numbers == expected_numbers

    evaluated = safe_eval_expr(extracted_expr)
    target_matched = evaluated is not None and abs(evaluated - target) < 1e-5

    hack_detected = (not check_numbers_exact) and target_matched and (not numbers_valid)

    if check_numbers_exact:
        correct_reward = 1.0 if (numbers_valid and target_matched) else 0.0
    else:
        # Intentional bug for Lesson 5 Reward Hacking ablation
        correct_reward = 1.0 if target_matched else 0.0

    if hack_detected:
        reason = f"Reward hack: expression evaluates to {target} without using {expected_numbers}"
    elif numbers_valid and target_matched:
        reason = "Exact match"
    elif not numbers_valid:
        reason = f"Number mismatch: used {used_numbers}, expected {expected_numbers}"
    elif evaluated is None:
        reason = "Invalid arithmetic expression"
    else:
        reason = f"Evaluated to {evaluated:g}, expected {target}"

    return RewardBreakdown(
        format_reward=format_reward,
        correct_reward=correct_reward,
        total_reward=round(format_reward + correct_reward + reward_shift, 4),
        has_think_tags=has_think,
        has_answer_tags=has_answer,
        extracted_expr=extracted_expr,
        evaluated_value=round(evaluated, 4) if evaluated is not None else None,
        numbers_valid=numbers_valid,
        target_matched=target_matched,
        hack_detected=hack_detected,
        reason=reason,
    )
