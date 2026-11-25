# 02 · Unified Data Schema & WebSocket Protocol

## Design Principle

Both `RealGPUTrainer` (live GPU runs saved to `runs/*.json`), `MockTrainer` (CPU dev runs), and `demo_data.py` (pre-recorded static bundle `frontend/src/data/demoRuns.json`) emit the exact same `RunLog` JSON schema (`schema_version = "1.0.0"`). Any real run collected on your home GPU can be loaded directly into the browser via **Telemetry -> Import GPU Run JSON**, or copied straight into the static demo bundle.

## Core Types (`backend/llm_rl_lab/schema.py` ↔ `frontend/src/types/lab.ts`)

### `RunLog`

- `schema_version`: `"1.0.0"`
- `metadata`: `RunMetadata` (`run_id`, `preset_id`, `lesson_id`, `algorithm`, `model_name`, `dtype`, `lora_rank`, `group_size`, `max_new_tokens`, `kl_beta`, `clip_eps`, `update_epochs`, `learning_rate`, `use_format_reward`, `check_numbers_exact`, `reward_shift`, `use_baseline`, `is_mock`, `created_at`)
- `steps`: `StepLog[]`

### `StepLog`

- `step`: integer training step
- `prompt_numbers`: `int[]` (e.g., `[3, 7, 12]`)
- `prompt_target`: `int` (e.g., `33`)
- `prompt_solution`: reference expression string (e.g., `"3 * 7 + 12"`)
- `metrics`: `StepMetrics` (`accuracy`, `mean_reward`, `reward_std`, `mean_response_length`, `entropy`, `kl_divergence`, `clip_fraction`, `loss`, `grad_norm`, `zero_grad_step`, `vram_allocated_gb`, `vram_peak_gb`, `step_time_sec`)
- `group_mean_reward`, `group_std_reward`, `zero_grad_group`
- `samples`: `SampleRollout[]` (all `G` completions for the current prompt)

### `SampleRollout`

- `index`, `raw_text`, `think_text`, `answer_text`, `num_tokens`, `mean_log_prob`, `reward`, `advantage`
- `breakdown`: `RewardBreakdown` (`format_reward`, `correct_reward`, `total_reward`, `has_think_tags`, `has_answer_tags`, `extracted_expr`, `evaluated_value`, `numbers_valid`, `target_matched`, `hack_detected`, `reason`)
- `token_probs`: optional `TokenProbInfo[]` (`token`, `prob`, `log_prob`, `entropy`, `kl`, `advantage`, `top_candidates` up to Top-5) used by the Microscope token heatmap.

## REST Endpoints

| Method & Path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | Public | Liveness check + active training status |
| `GET /api/device` | `X-Lab-Token` | GPU/MPS/CPU detection, recommended dtype, VRAM stats, `HF_ENDPOINT` |
| `GET /api/presets` | `X-Lab-Token` | List all 10 experiment presets |
| `POST /api/dry-run` | `X-Lab-Token` | 1-second AST + dummy-tensor validation for `lesson_id` + `code` |
| `POST /api/train/start` | `X-Lab-Token` | Start async training run (runs dry-run first if `custom_code` provided) |
| `POST /api/train/stop` | `X-Lab-Token` | Signal cooperative cancellation via `asyncio.Event` |
| `GET /api/runs` | `X-Lab-Token` | List recent JSON logs in `runs/` |
| `GET /api/runs/{run_id}` | `X-Lab-Token` | Fetch a saved `RunLog` JSON |

## WebSocket Events (`/ws/train?token=...`)

- `{"type": "connected", "device": DeviceTelemetry}`
- `{"type": "run_started", "metadata": RunMetadata}`
- `{"type": "step", "step": StepLog}`
- `{"type": "log", "level": "info"|"warn"|"error", "message": "..."}`
- `{"type": "run_finished", "run_id": "...", "steps": N}`
- `{"type": "error", "message": "..."}`
