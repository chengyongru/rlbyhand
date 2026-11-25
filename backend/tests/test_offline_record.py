import math
from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from llm_rl_lab.countdown import verify_countdown
from llm_rl_lab.offline_record import PreferencePair, make_dpo_update, select_preference_pairs
from llm_rl_lab.schema import RunLog, RunMetadata, SampleRollout, StepLog, StepMetrics


CORRECT = " <answer>3 * 7 + 12</answer>\n"
HACK = "<answer>33</answer>"


def step(target, *texts, numbers=(3, 7, 12)):
    samples = []
    for i, text in enumerate(texts):
        b = verify_countdown(text, list(numbers), target)
        samples.append(SampleRollout(
            index=i, raw_text=text, think_text="", answer_text="", num_tokens=3,
            mean_log_prob=-1.0, reward=10.0 if text == HACK else 0.0,
            advantage=0, breakdown=b,
        ))
    return StepLog(
        step=0, prompt_numbers=list(numbers), prompt_target=target, prompt_solution="not a sample",
        metrics=StepMetrics(step=0, accuracy=0, mean_reward=0, reward_std=0,
                            mean_response_length=0, entropy=0, kl_divergence=0),
        group_mean_reward=0, group_std_reward=0, samples=samples,
    )


def probe(*steps):
    return RunLog(metadata=RunMetadata(run_id="probe", preset_id="sft_probe", lesson_id="lesson-1",
                                       algorithm="sft_probe", is_mock=False), steps=list(steps))


def test_selects_only_logged_raw_text_from_an_identical_prompt():
    log = probe(step(33, " ", CORRECT), step(34, "wrong target"),
                step(33, "other prompt", numbers=(1, 2, 3)), step(33, HACK, "later wrong"))
    pairs = select_preference_pairs(log)
    assert pairs == (PreferencePair((3, 7, 12), 33, CORRECT, HACK),)
    log.steps.clear()
    assert (pairs[0].chosen, pairs[0].rejected) == (CORRECT, HACK)


@pytest.mark.parametrize("field,value", [("is_mock", True), ("algorithm", "grpo"),
                                         ("preset_id", "baseline_grpo")])
def test_rejects_non_probe_sources_before_touching_model(field, value):
    log = probe(step(33, CORRECT, HACK))
    setattr(log.metadata, field, value)
    with pytest.raises(ValueError, match="real .*sft_probe"):
        make_dpo_update(log, None, None, "cpu", 0.1)


def test_insufficient_pairs_do_not_fall_back_to_generated_or_cross_prompt_answers():
    log = probe(step(33, CORRECT), step(34, HACK))
    with pytest.raises(ValueError, match="found 0"):
        make_dpo_update(log, None, None, "cpu", 0.1)
    log.steps.append(step(33, HACK))
    with pytest.raises(ValueError, match="at least 2 .*found 1"):
        make_dpo_update(log, None, None, "cpu", 0.1, min_pairs=2)


def test_update_uses_frozen_reference_and_response_only_logp_sums():
    torch = pytest.importorskip("torch")

    class Tokenizer:
        def apply_chat_template(self, messages, *, tokenize, add_generation_prompt):
            assert not tokenize and add_generation_prompt
            assert "Numbers: [3, 7, 12], Target: 33" in messages[-1]["content"]
            return "rendered prompt"

        def encode(self, text, *, add_special_tokens=True):
            assert add_special_tokens == (text == "rendered prompt")
            return {"rendered prompt": [0, 1], CORRECT: [2, 2], HACK: [3]}[text]

    class TinyLM(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.bias = torch.nn.Parameter(torch.tensor([0.0, 0.1, 0.4, -0.2]))
            self.adapter_on = True
            self.calls = []

        @contextmanager
        def disable_adapter(self):
            self.adapter_on = False
            try:
                yield
            finally:
                self.adapter_on = True

        def forward(self, input_ids, *, use_cache):
            assert not use_cache
            self.calls.append((self.adapter_on, torch.is_grad_enabled(), input_ids.tolist()))
            bias = self.bias if self.adapter_on else torch.zeros_like(self.bias)
            return SimpleNamespace(logits=input_ids.unsqueeze(-1) * bias)

    log = probe(step(33, HACK, CORRECT))
    model = TinyLM()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.2)
    update = make_dpo_update(log, model, Tokenizer(), "cpu", beta=0.5)
    log.steps.clear()  # The updater cannot consult new samples, even on later steps.
    p1 = model.bias.detach().log_softmax(0)  # Distribution after the last prompt token (id 1).
    p2 = (2 * model.bias.detach()).log_softmax(0)  # After the first chosen token (id 2).
    margin = 0.5 * (p1[2] + p2[2] - p1[3] + math.log(4))  # Uniform base, unequal lengths.
    expected_loss = torch.nn.functional.softplus(-margin).item()
    loss, norm = update(0, optimizer)
    assert loss == pytest.approx(expected_loss)
    assert norm > 0
    assert update(1, optimizer)[0] < loss
    ids = [[[0, 1, 2, 2]], [[0, 1, 3]]]
    assert model.calls == ([(False, False, x) for x in ids] + [(True, True, x) for x in ids] * 2)
